import * as React from 'react';
import { Card, Button } from './UI';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'Ocorreu um erro inesperado.';
      let details = '';

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error) {
            errorMessage = 'Erro de permissão no banco de dados.';
            details = `Operação: ${parsed.operationType} em ${parsed.path}`;
          }
        }
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4">
          <Card className="max-w-md p-8 text-center shadow-xl border-none">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertTriangle size={32} />
            </div>
            <h1 className="mb-2 text-xl font-bold text-gray-900">Ops! Algo deu errado</h1>
            <p className="mb-6 text-gray-500">{errorMessage}</p>
            {details && (
              <div className="mb-6 rounded-lg bg-gray-50 p-3 text-left text-xs font-mono text-gray-600">
                {details}
              </div>
            )}
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full gap-2"
            >
              <RefreshCw size={18} />
              Recarregar Página
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
