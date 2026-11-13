package br.com.docalivre.fazumfreela;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.format.DateFormat;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Date;
import java.util.regex.Pattern;

/**
 * Tela "App do fazumfreela": mostra se este celular esta ativado, o ultimo resumo da conta e a permissao de
 * notificacao. Tambem recebe o link fazumfreela://ativar?t=... do botao "Ativar neste celular" do fazumfreela.
 */
public class StatusActivity extends Activity {
    private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]{30,100}");
    private static final int PEDIDO_NOTIFICACAO = 7;
    private LinearLayout root;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.parseColor("#0B1B2E"));
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int margem = dp(20);
        root.setPadding(margem, dp(28), margem, margem);
        scroll.addView(root, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(scroll);
        handleSetup(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleSetup(intent);
        render();
    }

    @Override
    protected void onResume() {
        super.onResume();
        ResumoWorker.refreshNow(this);
        render();
        root.postDelayed(this::render, 3000);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        render();
    }

    /** fazumfreela://ativar?t=<codigo>: guarda o codigo deste celular e ja busca o resumo. */
    private void handleSetup(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !"fazumfreela".equals(data.getScheme())) return;
        intent.setData(null);
        String token = data.getQueryParameter("t");
        if (token != null && TOKEN.matcher(token).matches()) {
            String antigo = Prefs.token(this);
            if (antigo != null && !antigo.equals(token)) ResumoWorker.avisarSaida(antigo);
            Prefs.setToken(this, token);
            ResumoWorker.schedulePeriodic(this);
            ResumoWorker.refreshNow(this);
            Toast.makeText(this, "Celular ativado no fazumfreela.", Toast.LENGTH_LONG).show();
            if (!notificacoesPermitidas()) {
                requestPermissions(new String[] {"android.permission.POST_NOTIFICATIONS"}, PEDIDO_NOTIFICACAO);
            }
        } else {
            Toast.makeText(this, "Link de ativação inválido.", Toast.LENGTH_LONG).show();
        }
    }

    private boolean notificacoesPermitidas() {
        return Build.VERSION.SDK_INT < 33
                || checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED;
    }

    private void render() {
        root.removeAllViews();
        texto("fazumfreela", 24, Color.WHITE, true);
        texto("Aplicativo versão " + ResumoWorker.versao(this), 13, Color.parseColor("#9FB3C8"), false);
        espaco(18);

        boolean ativado = Prefs.token(this) != null;
        JSONObject json = null;
        if (ativado) {
            try {
                String guardado = Prefs.resumo(this);
                if (guardado != null) json = new JSONObject(guardado);
            } catch (Exception ignored) {
                json = null;
            }
        }
        String nome = json == null ? "" : json.optString("nome", "");
        cartao(ativado ? "Este celular está ativado" : "Este celular ainda não está ativado",
                ativado ? (nome.isEmpty() ? "O widget e os avisos usam a sua conta do fazumfreela."
                                : "Conta: " + nome + ". O widget e os avisos usam esta conta.")
                        : "Abra o fazumfreela, entre na sua conta, vá em Aplicativo e toque em “Ativar neste celular”.",
                ativado);

        if (ativado) {
            String erro = Prefs.erro(this);
            if (erro != null) {
                cartao("Não foi possível buscar o resumo", erro, false);
            } else if (json != null) {
                StringBuilder linhas = new StringBuilder();
                JSONArray itens = json.optJSONArray("itens");
                for (int i = 0; itens != null && i < itens.length(); i++) {
                    JSONObject item = itens.optJSONObject(i);
                    if (item == null) continue;
                    if (linhas.length() > 0) linhas.append('\n');
                    linhas.append(item.optString("rotulo", "")).append(": ")
                            .append(item.isNull("valor") ? "—" : String.valueOf(item.optInt("valor", 0)));
                }
                String quando = DateFormat.getTimeFormat(this).format(new Date(Prefs.resumoAt(this)));
                cartao("Resumo às " + quando, linhas.length() > 0 ? linhas.toString() : "Nada pendente.", true);
            } else {
                cartao("Buscando o resumo da sua conta…", "Isso leva alguns segundos na primeira vez.", true);
            }
        }

        cartao(notificacoesPermitidas() ? "Notificações permitidas" : "Notificações bloqueadas",
                notificacoesPermitidas()
                        ? "Você é avisado de convites, contratações, vagas novas e candidatos, mesmo com o app fechado."
                        : "Sem a permissão, o app não consegue avisar das novidades.",
                notificacoesPermitidas());
        if (!notificacoesPermitidas()) {
            botao("Permitir notificações",
                    v -> requestPermissions(new String[] {"android.permission.POST_NOTIFICATIONS"}, PEDIDO_NOTIFICACAO));
        }

        espaco(8);
        final String inicio = json == null ? "/" : json.optString("abrir", "/");
        botao("Abrir o fazumfreela", v -> abrir(inicio));
        if (ativado) {
            botao("Atualizar agora", v -> {
                ResumoWorker.refreshNow(this);
                Toast.makeText(this, "Atualizando…", Toast.LENGTH_SHORT).show();
                root.postDelayed(this::render, 4000);
            });
            botao("Desativar neste celular", v -> {
                ResumoWorker.avisarSaida(Prefs.token(this));
                Prefs.clearToken(this);
                ResumoWorker.cancelPeriodic(this);
                Atalhos.limpar(this);
                ResumoWidgetProvider.renderAll(this);
                render();
            });
        } else {
            botao("Ativar neste celular", v -> abrir("/?aba=aplicativo"));
        }
    }

    private void abrir(String link) {
        startActivity(Prefs.abrirNoApp(this, link));
    }

    private int dp(int valor) {
        return Math.round(valor * getResources().getDisplayMetrics().density);
    }

    private TextView texto(String conteudo, int tamanho, int cor, boolean negrito) {
        TextView view = new TextView(this);
        view.setText(conteudo);
        view.setTextSize(tamanho);
        view.setTextColor(cor);
        if (negrito) view.setTypeface(Typeface.DEFAULT_BOLD);
        root.addView(view);
        return view;
    }

    private void espaco(int altura) {
        View view = new View(this);
        root.addView(view, new LinearLayout.LayoutParams(1, dp(altura)));
    }

    private void cartao(String titulo, String detalhe, boolean ok) {
        LinearLayout caixa = new LinearLayout(this);
        caixa.setOrientation(LinearLayout.VERTICAL);
        caixa.setBackgroundColor(Color.parseColor("#13304F"));
        caixa.setPadding(dp(16), dp(14), dp(16), dp(14));
        TextView t = new TextView(this);
        t.setText(titulo);
        t.setTextSize(16);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setTextColor(ok ? Color.parseColor("#4ADE80") : Color.parseColor("#F9DB00"));
        caixa.addView(t);
        TextView d = new TextView(this);
        d.setText(detalhe);
        d.setTextSize(14);
        d.setTextColor(Color.parseColor("#DCE4EE"));
        d.setPadding(0, dp(4), 0, 0);
        caixa.addView(d);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, dp(10));
        root.addView(caixa, params);
    }

    private void botao(String rotulo, View.OnClickListener acao) {
        Button button = new Button(this);
        button.setText(rotulo);
        button.setAllCaps(false);
        button.setTextSize(16);
        button.setGravity(Gravity.CENTER);
        button.setOnClickListener(acao);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(52));
        params.setMargins(0, 0, 0, dp(8));
        root.addView(button, params);
    }
}
