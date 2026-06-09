// NF-e XML parser (NFe 4.0 — handles with/without nfeProc wrapper)

export type NfeItem = {
  cProd: string;
  xProd: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
};

export type NfeData = {
  nNF: string;
  dhEmi: string; // ISO date
  emitNome: string;
  emitCNPJ: string;
  vNF: number;
  items: NfeItem[];
  rawXml: string;
};

const q = (root: Element | Document, tag: string): Element | null =>
  root.getElementsByTagName(tag)[0] ?? null;

const txt = (el: Element | null): string => el?.textContent?.trim() ?? "";
const num = (s: string): number => Number(s.replace(",", ".")) || 0;

export function parseNfeXml(xml: string): NfeData {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const parseErr = doc.getElementsByTagName("parsererror")[0];
  if (parseErr) throw new Error("XML inválido");

  const infNFe = q(doc, "infNFe");
  if (!infNFe) throw new Error("XML não é uma NF-e válida (sem infNFe)");

  const ide = q(infNFe, "ide");
  const emit = q(infNFe, "emit");
  const total = q(infNFe, "total");
  const icmsTot = total ? q(total, "ICMSTot") : null;

  const dets = Array.from(infNFe.getElementsByTagName("det"));
  const items: NfeItem[] = dets.map((det) => {
    const prod = q(det, "prod");
    return {
      cProd: txt(prod ? q(prod, "cProd") : null),
      xProd: txt(prod ? q(prod, "xProd") : null),
      qCom: num(txt(prod ? q(prod, "qCom") : null)),
      vUnCom: num(txt(prod ? q(prod, "vUnCom") : null)),
      vProd: num(txt(prod ? q(prod, "vProd") : null)),
    };
  });

  return {
    nNF: txt(ide ? q(ide, "nNF") : null),
    dhEmi: txt(ide ? q(ide, "dhEmi") : null) || txt(ide ? q(ide, "dEmi") : null),
    emitNome: txt(emit ? q(emit, "xNome") : null),
    emitCNPJ: txt(emit ? q(emit, "CNPJ") : null),
    vNF: num(txt(icmsTot ? q(icmsTot, "vNF") : null)),
    items,
    rawXml: xml,
  };
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
