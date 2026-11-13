package br.com.docalivre.fazumfreela;

import android.content.Context;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Atalhos que mudam conforme a conta (ao segurar o icone): o resumo traz, por exemplo, "Publicar vaga" para a
 * empresa e "Vagas aceitas" para o profissional. Os fixos ficam em res/xml/shortcuts.xml.
 */
final class Atalhos {
    private Atalhos() {}

    private static final int MAX = 2;

    static void aplicar(Context context, JSONObject resumo) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) return;
        ShortcutManager manager = context.getSystemService(ShortcutManager.class);
        if (manager == null) return;
        JSONArray lista = resumo == null ? null : resumo.optJSONArray("atalhos");
        List<ShortcutInfo> atalhos = new ArrayList<>();
        if (lista != null) {
            for (int i = 0; i < lista.length() && atalhos.size() < MAX; i++) {
                JSONObject item = lista.optJSONObject(i);
                if (item == null) continue;
                String id = item.optString("id", "");
                String rotulo = item.optString("rotulo", "");
                if (id.isEmpty() || rotulo.isEmpty()) continue;
                atalhos.add(new ShortcutInfo.Builder(context, "conta-" + id)
                        .setShortLabel(rotulo.length() > 25 ? rotulo.substring(0, 25) : rotulo)
                        .setIcon(Icon.createWithResource(context, R.mipmap.ic_launcher))
                        .setIntent(Prefs.abrirNoApp(context, item.optString("link", "/")))
                        .build());
            }
        }
        try {
            manager.setDynamicShortcuts(atalhos);
        } catch (Exception ignored) {
            // limite de chamadas do sistema: tenta de novo na proxima busca
        }
    }

    static void limpar(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) return;
        ShortcutManager manager = context.getSystemService(ShortcutManager.class);
        if (manager != null) manager.removeAllDynamicShortcuts();
    }
}
