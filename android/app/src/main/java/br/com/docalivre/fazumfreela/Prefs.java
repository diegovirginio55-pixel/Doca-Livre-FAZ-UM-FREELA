package br.com.docalivre.fazumfreela;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

import org.json.JSONArray;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

/** Configuracao e ultimo resumo, guardados so no celular. */
final class Prefs {
    private Prefs() {}

    static final String SITE = "https://fazumfreela.com.br";
    /** Servidor do fazumfreela (a mesma API que o site usa). */
    static final String API = "https://fazumfreela-api.purpleocean-4b1d485c.brazilsouth.azurecontainerapps.io";
    private static final String NAME = "fazumfreela";
    private static final int MAX_VISTOS = 300;

    private static SharedPreferences sp(Context context) {
        return context.getApplicationContext().getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    /** Codigo deste celular, vindo do botao "Ativar neste celular" do fazumfreela. */
    static String token(Context context) {
        return sp(context).getString("token", null);
    }

    static void setToken(Context context, String token) {
        sp(context).edit().putString("token", token).remove("resumo").remove("resumo_at").remove("erro")
                .remove("vistos").apply();
    }

    static void clearToken(Context context) {
        sp(context).edit().remove("token").remove("resumo").remove("resumo_at").remove("erro").remove("vistos").apply();
    }

    static void saveResumo(Context context, String json) {
        sp(context).edit().putString("resumo", json).putLong("resumo_at", System.currentTimeMillis()).remove("erro").apply();
    }

    static String resumo(Context context) {
        return sp(context).getString("resumo", null);
    }

    static long resumoAt(Context context) {
        return sp(context).getLong("resumo_at", 0);
    }

    static void setErro(Context context, String erro) {
        sp(context).edit().putString("erro", erro).apply();
    }

    static String erro(Context context) {
        return sp(context).getString("erro", null);
    }

    /** Avisos ja mostrados (para nao repetir a mesma notificacao). Sem lista = primeira busca depois de ativar. */
    static boolean temVistos(Context context) {
        return sp(context).contains("vistos");
    }

    static Set<String> vistos(Context context) {
        Set<String> out = new LinkedHashSet<>();
        try {
            JSONArray lista = new JSONArray(sp(context).getString("vistos", "[]"));
            for (int i = 0; i < lista.length(); i++) out.add(lista.optString(i));
        } catch (Exception ignored) {
            // lista corrompida: comeca de novo
        }
        return out;
    }

    static void setVistos(Context context, Collection<String> ids) {
        JSONArray lista = new JSONArray();
        int n = 0;
        for (String id : ids) {
            if (n++ >= MAX_VISTOS) break;
            lista.put(id);
        }
        sp(context).edit().putString("vistos", lista.toString()).apply();
    }

    /** So aceita caminhos do proprio site ("/..."), nunca um endereco de fora. */
    static String caminhoSeguro(String link) {
        if (link == null || !link.startsWith("/") || link.startsWith("//") || link.contains("\\")) return "/";
        return link;
    }

    /**
     * Intencao que abre o fazumfreela (no app, em tela cheia) num caminho do site. O ?app=android avisa o site que
     * e o app (o site bloqueia o "app instalado pelo navegador", que tambem roda em tela cheia).
     */
    static Intent abrirNoApp(Context context, String link) {
        String caminho = caminhoSeguro(link);
        String marca = (caminho.contains("?") ? "&" : "?") + "app=android";
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(SITE + caminho + marca));
        open.setClass(context, LauncherActivity.class);
        return open;
    }
}
