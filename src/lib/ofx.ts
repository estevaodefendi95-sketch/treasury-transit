// Parser OFX/QFX simples (suficiente para a maioria dos bancos brasileiros).
export type OfxRow = {
  fitid: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: "credito" | "debito";
};

function tag(block: string, name: string): string | null {
  const re = new RegExp(`<${name}>([^<\\r\\n]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function ofxDate(s: string | null): string {
  if (!s) return "";
  // YYYYMMDD[HHMMSS][...]
  const y = s.slice(0, 4);
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  if (y && m && d) return `${y}-${m}-${d}`;
  return "";
}

export function parseOfx(content: string): OfxRow[] {
  // pega todos os <STMTTRN>...</STMTTRN>
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const rows: OfxRow[] = [];
  for (const b of blocks) {
    const amountRaw = tag(b, "TRNAMT");
    const amount = Number((amountRaw ?? "0").replace(",", "."));
    const fitid = tag(b, "FITID") ?? crypto.randomUUID();
    const date = ofxDate(tag(b, "DTPOSTED"));
    const name = tag(b, "NAME") ?? "";
    const memo = tag(b, "MEMO") ?? "";
    const description = [name, memo].filter(Boolean).join(" - ").trim() || "Transação";
    rows.push({
      fitid,
      date,
      description,
      amount: Math.abs(amount),
      type: amount >= 0 ? "credito" : "debito",
    });
  }
  return rows;
}
