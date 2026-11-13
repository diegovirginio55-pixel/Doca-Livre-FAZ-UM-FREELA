package br.com.docalivre.fazumfreela;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.text.format.DateFormat;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Date;

/**
 * Widget da tela inicial: ate 3 numeros da conta (o fazumfreela manda os rotulos conforme o tipo de conta).
 * Mostra na hora o ultimo resumo guardado e pede ao ResumoWorker para buscar o atual.
 */
public class ResumoWidgetProvider extends AppWidgetProvider {
    private static final int[] LINHAS = {R.id.widget_linha1, R.id.widget_linha2, R.id.widget_linha3};
    private static final int[] ROTULOS = {R.id.widget_rotulo1, R.id.widget_rotulo2, R.id.widget_rotulo3};
    private static final int[] VALORES = {R.id.widget_valor1, R.id.widget_valor2, R.id.widget_valor3};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        render(context, manager, widgetIds);
        ResumoWorker.refreshNow(context);
    }

    @Override
    public void onEnabled(Context context) {
        if (Prefs.token(context) != null) ResumoWorker.schedulePeriodic(context);
    }

    /** Redesenha todos os widgets com o resumo guardado. */
    static void renderAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, ResumoWidgetProvider.class));
        if (ids != null && ids.length > 0) render(context, manager, ids);
    }

    private static void render(Context context, AppWidgetManager manager, int[] widgetIds) {
        boolean ativado = Prefs.token(context) != null;
        JSONObject json = null;
        String guardado = ativado ? Prefs.resumo(context) : null;
        if (guardado != null) {
            try {
                json = new JSONObject(guardado);
            } catch (Exception ignored) {
                json = null;
            }
        }
        long at = Prefs.resumoAt(context);
        String erro = ativado ? Prefs.erro(context) : null;
        JSONArray itens = json == null ? null : json.optJSONArray("itens");

        Intent open = Prefs.abrirNoApp(context, json == null ? "/" : json.optString("abrir", "/"));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent tap = PendingIntent.getActivity(
                context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        for (int id : widgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_resumo);
            String titulo = json == null ? "" : json.optString("titulo", "");
            views.setTextViewText(R.id.widget_titulo, titulo.isEmpty() ? context.getString(R.string.widget_title) : titulo);
            for (int i = 0; i < LINHAS.length; i++) {
                JSONObject item = itens == null ? null : itens.optJSONObject(i);
                if (item == null) {
                    views.setViewVisibility(LINHAS[i], View.GONE);
                    continue;
                }
                views.setViewVisibility(LINHAS[i], View.VISIBLE);
                views.setTextViewText(ROTULOS[i], item.optString("rotulo", ""));
                views.setTextViewText(VALORES[i], item.isNull("valor") ? "—" : String.valueOf(item.optInt("valor", 0)));
            }
            if (!ativado) {
                views.setTextViewText(R.id.widget_updated, context.getString(R.string.widget_waiting));
            } else if (erro != null) {
                views.setTextViewText(R.id.widget_updated, erro);
            } else if (json != null) {
                views.setTextViewText(R.id.widget_updated,
                        "atualizado às " + DateFormat.getTimeFormat(context).format(new Date(at)));
            } else {
                views.setTextViewText(R.id.widget_updated, "Buscando o resumo da sua conta…");
            }
            views.setOnClickPendingIntent(R.id.widget_root, tap);
            manager.updateAppWidget(id, views);
        }
    }
}
