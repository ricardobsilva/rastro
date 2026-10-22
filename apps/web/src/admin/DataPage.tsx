import { useRef, useState } from 'react';
import { api, errorMessage } from '../api/client';

const FORMAT = 'rastro-export';
const VERSION = 1;
const NOT_RASTRO = 'Este arquivo não é uma exportação do Rastro.';

type ExportFile = { format: string; version: number; exportedAt: string; tables: Record<string, unknown[]> };

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
const when = (iso: string) => {
  const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get('day')}/${get('month')}/${get('year')} às ${get('hour')}:${get('minute')}`;
};

/** Confere o arquivo antes de mostrar o resumo; o servidor valida de novo ao importar. */
function parse(text: string): ExportFile {
  let data: Partial<ExportFile>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(NOT_RASTRO);
  }
  if (data?.format !== FORMAT) throw new Error(NOT_RASTRO);
  if (typeof data.version === 'number' && data.version > VERSION) throw new Error('Este arquivo é de uma versão mais nova do Rastro.');
  if (data.version !== VERSION || typeof data.tables !== 'object' || !data.tables) throw new Error('O arquivo está incompleto ou corrompido.');
  return data as ExportFile;
}

const readText = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    r.readAsText(f);
  });

type Props = { reload?: () => void };

export function DataPage({ reload = () => window.location.assign('/gestor') }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<ExportFile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function choose(f: File | undefined) {
    if (!f) return;
    setError('');
    setFile(null);
    try {
      setFile(parse(await readText(f)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  async function confirm() {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/api/admin/import', file);
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const count = (t: string) => file?.tables[t]?.length ?? 0;

  return (
    <div className="page">
      <div>
        <div className="eyebrow">Cópia dos dados</div>
        <h1 className="page-title">Exportar e importar</h1>
      </div>

      <section className="guide-card data-card">
        <h2 className="data-title">Exportar dados</h2>
        <p className="guide-text">
          Baixa um arquivo com tudo: equipe, tarefas, listas e o histórico de marcações. Guarde num lugar seguro,
          porque ele contém os PINs dos gestores.
        </p>
        <div>
          <a className="guide-btn guide-btn--primary data-link" href="/api/admin/export" download>Exportar dados</a>
        </div>
      </section>

      <section className="guide-card data-card">
        <h2 className="data-title">Importar dados</h2>
        {done ? (
          <>
            <h3 className="data-title data-title--ok">Dados importados</h3>
            <p className="guide-text">Por segurança, todos precisam entrar de novo com o PIN, inclusive os aparelhos da equipe.</p>
            <div><button type="button" className="guide-btn guide-btn--primary" onClick={reload}>Entrar de novo</button></div>
          </>
        ) : file ? (
          <>
            <div className="guide-summary" data-testid="import-summary">
              <p>Arquivo exportado em <strong>{when(file.exportedAt)}</strong>.</p>
              <p>
                {n(count('employees'), 'funcionário', 'funcionários')} · {n(count('items'), 'tarefa', 'tarefas')} ·{' '}
                {n(count('checklists'), 'lista', 'listas')} · {n(count('audit_events'), 'registro no histórico', 'registros no histórico')}
              </p>
            </div>
            <div className="data-warning">
              Isso vai <strong>apagar todos os dados atuais</strong> e colocar os do arquivo no lugar. Não dá para desfazer.
              Depois, você e todos os aparelhos vão precisar entrar de novo com o PIN.
            </div>
            {error && <div role="alert" className="guide-error">{error}</div>}
            <div className="guide-nav">
              <button type="button" className="guide-btn" onClick={() => { setFile(null); setError(''); }}>Cancelar</button>
              <button type="button" className="guide-btn data-danger" disabled={busy} onClick={confirm}>
                {busy ? 'Importando…' : 'Substituir todos os dados'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="guide-text">Use um arquivo baixado em “Exportar dados”. Antes de mudar qualquer coisa, mostramos o que tem nele e pedimos confirmação.</p>
            <div>
              <label className="guide-btn data-link" htmlFor="data-file">Escolher arquivo de dados</label>
              <input
                id="data-file" ref={input} type="file" accept=".json,application/json" className="visually-hidden"
                onChange={(e) => choose(e.target.files?.[0])}
              />
            </div>
            {error && <div role="alert" className="guide-error">{error}</div>}
          </>
        )}
      </section>
    </div>
  );
}
