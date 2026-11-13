package br.com.docalivre.fazumfreela;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Busca o resumo da conta em /api/app/resumo (com o codigo deste celular), atualiza o widget e os atalhos e avisa
 * das novidades (convite, contratacao confirmada, vaga nova, candidato novo, cadastro para aprovar).
 * Roda a cada 30 min e ao abrir a tela "App do fazumfreela".
 */
public class ResumoWorker extends Worker {
    private static final String PERIODIC = "resumo-periodic";
    private static final String NOW = "resumo-now";
    private static final String CANAL = "novidades";
    /** Mais que isso de uma vez vira uma notificacao so ("5 novidades"). */
    private static final int MAX_SEPARADAS = 3;

    public ResumoWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        String token = Prefs.token(context);
        if (token == null) return Result.success();

        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(Prefs.API + "/api/app/resumo").openConnection();
            connection.setConnectTimeout(20_000);
            connection.setReadTimeout(60_000);
            connection.setRequestProperty("X-App-Token", token);
            connection.setRequestProperty("X-App-Versao", versao(context));
            connection.setRequestProperty("Accept", "application/json");
            int code = connection.getResponseCode();
            if (code == 401 || code == 403) {
                Prefs.setErro(context, "Este celular foi desativado. Ative de novo no fazumfreela, em Aplicativo.");
                ResumoWidgetProvider.renderAll(context);
                return Result.success();
            }
            if (code != 200) return code >= 500 ? Result.retry() : Result.success();
            String corpo = readAll(connection.getInputStream());
            JSONObject json = new JSONObject(corpo);
            // o celular pode ter sido desativado enquanto buscava
            if (Prefs.token(context) == null) return Result.success();
            Prefs.saveResumo(context, corpo);
            ResumoWidgetProvider.renderAll(context);
            Atalhos.aplicar(context, json);
            avisar(context, json);
            return Result.success();
        } catch (Exception e) {
            return getRunAttemptCount() < 3 ? Result.retry() : Result.failure();
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    /** Notifica os avisos que ainda nao foram mostrados. Logo depois de ativar, so marca tudo como visto. */
    private static void avisar(Context context, JSONObject json) {
        JSONArray avisos = json.optJSONArray("avisos");
        if (avisos == null) return;
        boolean primeira = !Prefs.temVistos(context);
        Set<String> vistos = Prefs.vistos(context);
        List<JSONObject> novos = new ArrayList<>();
        LinkedHashSet<String> guardar = new LinkedHashSet<>();
        for (int i = 0; i < avisos.length(); i++) {
            JSONObject aviso = avisos.optJSONObject(i);
            if (aviso == null) continue;
            String id = aviso.optString("id", "");
            if (id.isEmpty()) continue;
            guardar.add(id);
            if (!vistos.contains(id)) novos.add(aviso);
        }
        guardar.addAll(vistos);
        Prefs.setVistos(context, guardar);
        if (primeira || novos.isEmpty()) return;

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= 33
                && context.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                    new NotificationChannel(CANAL, "Novidades do fazumfreela", NotificationManager.IMPORTANCE_DEFAULT));
        }
        if (novos.size() <= MAX_SEPARADAS) {
            for (JSONObject aviso : novos) {
                String id = aviso.optString("id");
                manager.notify(id.hashCode(), notificacao(context, id.hashCode(),
                        aviso.optString("titulo", "Novidade no fazumfreela"),
                        aviso.optString("texto", "Toque para ver."),
                        aviso.optString("link", "/")));
            }
        } else {
            JSONObject primeiro = novos.get(0);
            String texto = primeiro.optString("titulo", "") + " e mais " + (novos.size() - 1) + ".";
            manager.notify(1, notificacao(context, 1, novos.size() + " novidades no fazumfreela", texto,
                    primeiro.optString("link", "/")));
        }
    }

    private static Notification notificacao(Context context, int codigo, String titulo, String texto, String link) {
        Intent open = Prefs.abrirNoApp(context, link);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent tap = PendingIntent.getActivity(
                context, codigo, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder publico = builder(context)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("Novidade no fazumfreela")
                .setContentText("Desbloqueie o celular para ver.");
        return builder(context)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(titulo)
                .setContentText(texto)
                .setStyle(new Notification.BigTextStyle().bigText(texto))
                .setContentIntent(tap)
                .setAutoCancel(true)
                // Na tela bloqueada aparece so "Novidade no fazumfreela" (nome de empresa e cargo ficam escondidos).
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setPublicVersion(publico.build())
                .build();
    }

    private static Notification.Builder builder(Context context) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(context, CANAL)
                : new Notification.Builder(context);
    }

    static String versao(Context context) {
        try {
            return context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "?";
        }
    }

    private static Constraints online() {
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    /** Atualiza ja. */
    static void refreshNow(Context context) {
        Context app = context.getApplicationContext();
        if (Prefs.token(app) == null) return;
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(ResumoWorker.class)
                .setConstraints(online())
                .build();
        WorkManager.getInstance(app).enqueueUniqueWork(NOW, ExistingWorkPolicy.REPLACE, request);
    }

    static void schedulePeriodic(Context context) {
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(ResumoWorker.class, 30, TimeUnit.MINUTES)
                .setConstraints(online())
                .build();
        WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    static void cancelPeriodic(Context context) {
        WorkManager.getInstance(context.getApplicationContext()).cancelUniqueWork(PERIODIC);
    }

    /** Ao desativar no celular, avisa o servidor para apagar o codigo deste celular (sem esperar a resposta). */
    static void avisarSaida(String token) {
        if (token == null) return;
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(Prefs.API + "/api/app/sair").openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(15_000);
                connection.setReadTimeout(15_000);
                connection.setRequestProperty("X-App-Token", token);
                connection.getResponseCode();
            } catch (Exception ignored) {
                // sem internet: o codigo fica sem uso e o fazumfreela mostra o celular como parado
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    private static String readAll(InputStream in) throws java.io.IOException {
        try (InputStream stream = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = stream.read(buffer)) != -1) out.write(buffer, 0, read);
            return out.toString("UTF-8");
        }
    }
}
