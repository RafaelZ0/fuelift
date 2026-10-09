"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Aviso, BotaoSecundario } from "@/components/ui";
import { lerCodigoDeBarras, type EstadoBarras } from "./actions";

type Fase = "parado" | "abrindo" | "lendo";

// A câmera só abre depois de um toque (exigência do iPhone) e é desligada ao sair da tela.
export function Leitor({ data, refeicao }: { data?: string; refeicao?: string }) {
  const [fase, setFase] = useState<Fase>("parado");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlesRef = useRef<{ stop: () => void } | null>(null);
  const ocupadoRef = useRef(false);

  function parar() {
    controlesRef.current?.stop();
    controlesRef.current = null;
    setFase("parado");
  }

  useEffect(() => () => controlesRef.current?.stop(), []);

  function enviar(codigo: string) {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    iniciar(async () => {
      const r: EstadoBarras = await lerCodigoDeBarras(codigo, data ?? null, refeicao ?? null);
      // Só chega aqui se não houve redirecionamento (erro).
      ocupadoRef.current = false;
      if (r?.erro) setAviso(r.erro);
    });
  }

  async function abrirCamera() {
    setAviso(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setAviso("Este navegador não permite usar a câmera. Digite os números do código.");
      return;
    }
    setFase("abrindo");
    try {
      // Carregado só aqui: a biblioteca (~400 KB) não pesa nas outras telas.
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
      const dicas = new Map();
      dicas.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]);
      dicas.set(DecodeHintType.TRY_HARDER, true);
      const leitor = new BrowserMultiFormatReader(dicas, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 1500 });
      const controles = await leitor.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        videoRef.current ?? undefined,
        (resultado, _erro, ctl) => {
          if (!resultado) return; // sem código no quadro: segue tentando
          ctl.stop();
          controlesRef.current = null;
          setFase("parado");
          enviar(resultado.getText());
        },
      );
      controlesRef.current = controles;
      setFase("lendo");
    } catch (e) {
      setFase("parado");
      const nome = e instanceof Error ? e.name : "";
      setAviso(
        nome === "NotAllowedError"
          ? "A câmera foi bloqueada. Libere em Ajustes do iPhone → Safari → Câmera, ou digite os números do código."
          : "Não consegui abrir a câmera. Digite os números do código.",
      );
    }
  }

  const [digitado, setDigitado] = useState("");

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className={`overflow-hidden rounded-2xl border-2 border-borda bg-superficie ${fase === "parado" ? "hidden" : ""}`}>
          {/* Pré-visualização da câmera: playsInline e muted são necessários no iPhone. */}
          <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" aria-label="Imagem da câmera" />
        </div>
        {fase === "lendo" ? <p role="status" className="text-lg text-suave">Aponte para o código de barras da embalagem…</p> : null}
        {pendente ? <p role="status" className="text-lg text-suave">Buscando o produto…</p> : null}
        {fase === "parado" ? (
          <button type="button" onClick={() => void abrirCamera()} disabled={pendente} className="min-h-14 w-full rounded-full bg-destaque px-6 text-lg font-bold text-sobre-destaque disabled:opacity-60">
            Abrir a câmera
          </button>
        ) : (
          <BotaoSecundario onClick={parar}>Fechar a câmera</BotaoSecundario>
        )}
      </div>

      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          setAviso(null);
          enviar(digitado);
        }}
        className="space-y-4"
        noValidate
      >
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-suave">Ou digite os números do código</span>
          <input
            value={digitado}
            onChange={(ev) => setDigitado(ev.target.value.replace(/D/g, "").slice(0, 13))}
            inputMode="numeric"
            autoComplete="off"
            maxLength={13}
            className="min-h-12 w-full border-b-2 border-borda bg-transparent py-2 text-xl font-semibold outline-none focus:border-marca"
          />
        </label>
        <BotaoSecundario type="submit">Buscar produto</BotaoSecundario>
      </form>

      {aviso ? <Aviso>{aviso}</Aviso> : null}
      <p className="text-sm text-suave">
        Dados de produtos: <a href="https://world.openfoodfacts.org" className="underline" target="_blank" rel="noopener noreferrer">Open Food Facts</a>, licença ODbL. Confira sempre com a embalagem.
      </p>
    </div>
  );
}
