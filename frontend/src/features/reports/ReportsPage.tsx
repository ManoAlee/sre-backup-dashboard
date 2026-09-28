import React, { useEffect, useState, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { api } from '@/services/api';
import {
  FileText,
  Search,
  RefreshCw,
  Copy,
  Check,
  Filter,
  Eye,
  Terminal,
  Download,
  BookOpen,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [docs, setDocs] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [docContent, setDocContent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [copied, setCopied] = useState(false);

  const loadDocs = async () => {
    try {
      setError(null);
      const res = await api.getDocsList();
      if (Array.isArray(res) && res.length > 0) {
        setDocs(res);
        if (!selectedDoc) {
          handleSelectDoc(res[0]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar repositório de documentos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleSelectDoc = async (item: any) => {
    setSelectedDoc(item);
    setIsLoadingDoc(true);
    try {
      const res = await api.getDocContent(item.path, item.type);
      setDocContent(res.content || (typeof res === 'string' ? res : 'Conteúdo em branco.'));
    } catch (err: any) {
      setDocContent(`Erro ao ler documento: ${err.message}`);
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(docContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadDoc = () => {
    const element = document.createElement('a');
    const file = new Blob([docContent], { type: 'text/markdown;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = selectedDoc?.name || 'documento.md';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const categories = useMemo(() => {
    return ['Todos', ...Array.from(new Set(docs.map((d) => d.category || 'Geral')))];
  }, [docs]);

  const filteredDocs = useMemo(() => {
    return docs.filter((d) => {
      const matchesCategory = selectedCategory === 'Todos' || (d.category || 'Geral') === selectedCategory;
      const term = searchQuery.toLowerCase();
      const matchesSearch =
        d.name?.toLowerCase().includes(term) ||
        d.path?.toLowerCase().includes(term) ||
        d.category?.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [docs, selectedCategory, searchQuery]);

  if (isLoading) return <LoadingState message="Carregando repositório de documentos e manuais corporativos..." />;
  if (error && docs.length === 0) return <ErrorState message={error} onRetry={loadDocs} />;

  return (
    <PageContainer
      title="Relatórios & Documentação Técnica"
      subtitle="Auditorias de infraestrutura, manuais de operação e diários de bordo organizados."
      actions={
        <Button variant="outline" size="sm" onClick={loadDocs} className="cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Atualizar Documentos
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Documents Index Column */}
        <div className="space-y-4">
          <Card
            header={
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                  <BookOpen className="w-4 h-4 text-sky-500" />
                  Índice ({filteredDocs.length})
                </span>
                <Badge variant="info" size="sm">Vault SRE</Badge>
              </div>
            }
          >
            <div className="space-y-3">
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar documento..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 text-[11px] rounded-lg transition-colors cursor-pointer font-medium ${
                      selectedCategory === cat
                        ? 'bg-sky-600 text-white font-semibold shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Document list */}
              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                {filteredDocs.map((doc, idx) => {
                  const isSelected = selectedDoc?.path === doc.path;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectDoc(doc)}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 dark:border-sky-800 text-sky-900 dark:text-sky-200 font-semibold shadow-2xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <FileText className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[11px]">{doc.name}</p>
                        {doc.category && (
                          <span className="text-[9px] text-slate-400 font-sans block mt-0.5">[{doc.category}]</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* Viewer Column */}
        <div className="lg:col-span-2">
          <Card
            header={
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-sm font-semibold truncate max-w-[70%] font-mono text-slate-900 dark:text-white">
                  {selectedDoc ? selectedDoc.name : 'Visualizador de Documentos'}
                </span>
                {selectedDoc && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
                      <button
                        onClick={() => setViewMode('formatted')}
                        className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                          viewMode === 'formatted' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-2xs' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                        }`}
                      >
                        <Eye className="w-3 h-3 inline mr-1" />
                        Formatado
                      </button>
                      <button
                        onClick={() => setViewMode('raw')}
                        className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                          viewMode === 'raw' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-2xs' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                        }`}
                      >
                        <Terminal className="w-3 h-3 inline mr-1" />
                        Raw
                      </button>
                    </div>

                    <Button size="sm" variant="ghost" onClick={handleDownloadDoc} className="cursor-pointer text-xs" title="Baixar documento">
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Baixar
                    </Button>

                    <Button size="sm" variant="outline" onClick={handleCopyContent} className="cursor-pointer text-xs">
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </Button>
                  </div>
                )}
              </div>
            }
          >
            {isLoadingDoc ? (
              <div className="p-12">
                <LoadingState message="Lendo conteúdo do documento..." />
              </div>
            ) : selectedDoc ? (
              viewMode === 'formatted' ? (
                <div className="p-6 bg-white dark:bg-slate-900/60 rounded-xl max-h-[72vh] overflow-y-auto border border-slate-200 dark:border-slate-800 prose prose-slate dark:prose-invert max-w-none text-xs leading-relaxed space-y-3">
                  {docContent.split('\n\n').map((para, pIdx) => {
                    if (para.startsWith('# ')) {
                      return <h1 key={pIdx} className="text-lg font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800">{para.replace('# ', '')}</h1>;
                    }
                    if (para.startsWith('## ')) {
                      return <h2 key={pIdx} className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-4 mb-2">{para.replace('## ', '')}</h2>;
                    }
                    if (para.startsWith('### ')) {
                      return <h3 key={pIdx} className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-2 mb-1">{para.replace('### ', '')}</h3>;
                    }
                    if (para.startsWith('```')) {
                      return (
                        <pre key={pIdx} className="p-3 bg-slate-950 text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto">
                          {para.replace(/```[a-z]*/g, '').trim()}
                        </pre>
                      );
                    }
                    if (para.startsWith('> ')) {
                      return (
                        <div key={pIdx} className="p-3 bg-sky-50 dark:bg-sky-950/40 border-l-4 border-sky-500 rounded-r-lg text-slate-700 dark:text-slate-300">
                          {para.replace('> ', '')}
                        </div>
                      );
                    }
                    return <p key={pIdx} className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{para}</p>;
                  })}
                </div>
              ) : (
                <div className="p-4 bg-slate-950 text-slate-200 font-mono text-xs rounded-xl overflow-x-auto max-h-[72vh] whitespace-pre-wrap leading-relaxed border border-slate-800 select-text">
                  {docContent}
                </div>
              )
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs">
                Selecione um documento do índice para visualizar todo o seu conteúdo.
              </div>
            )}
          </Card>
        </div>

      </div>
    </PageContainer>
  );
};
