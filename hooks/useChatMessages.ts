import { useState, useCallback, useRef, useEffect } from 'react';

// Tipos exportados do worker
import type { TranslationMessage } from '../workers/translation.worker';

type Message = {
  id: string | number;
  user: string;
  message: string;
  translatedText?: string;
  type: string;
  avatar?: string;
};

type WorkerMessage = 
  | { type: 'PARTIAL_RESULT'; data: TranslationMessage[] }
  | { type: 'TRANSLATION_COMPLETE'; data: TranslationMessage[] }
  | { type: 'TRANSLATION_ERROR'; error: string };

export const useChatMessages = (initialMessages: Message[] = []) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const messageQueue = useRef<Message[]>([]);
  const isProcessing = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);

  // Inicializa o worker
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Cria uma instância do worker usando Blob URL para evitar problemas de CORS
    const workerBlob = new Blob([
      'importScripts("https://unpkg.com/comlink/dist/umd/comlink.js");',
      'const worker = ' + createWorkerString() + ';',
      'Comlink.expose(worker);'
    ], { type: 'application/javascript' });
    
    const workerUrl = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerUrl);
    
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const { type, data, error } = e.data as any;
      
      switch (type) {
        case 'PARTIAL_RESULT':
          // Atualiza mensagens com traduções parciais
          setMessages(prev => {
            const updated = [...prev];
            data.forEach((translatedMsg: TranslationMessage) => {
              const index = updated.findIndex(m => m.id === translatedMsg.id);
              if (index !== -1) {
                updated[index] = { ...updated[index], ...translatedMsg };
              }
            });
            return updated;
          });
          break;
          
        case 'TRANSLATION_COMPLETE':
          // Processamento em lote concluído
          setMessages(prev => {
            const updated = [...prev];
            data.forEach((translatedMsg: TranslationMessage) => {
              const index = updated.findIndex(m => m.id === translatedMsg.id);
              if (index !== -1) {
                updated[index] = { ...updated[index], ...translatedMsg };
              }
            });
            return updated;
          });
          isProcessing.current = false;
          processQueue(); // Processa o próximo lote
          break;
          
        case 'TRANSLATION_ERROR':
          console.error('Erro na tradução:', error);
          isProcessing.current = false;
          processQueue(); // Tenta continuar com o próximo lote mesmo em caso de erro
          break;
      }
    };
    
    workerRef.current = worker;
    setIsWorkerReady(true);
    
    // Limpeza
    return () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, []);

  // Processa a fila de mensagens
  const processQueue = useCallback(() => {
    if (messageQueue.current.length === 0 || !workerRef.current || isProcessing.current || !isWorkerReady) {
      return;
    }

    isProcessing.current = true;
    const batch = messageQueue.current.splice(0, 10); // Processa em lotes menores
    
    // Envia mensagem para o worker
    workerRef.current.postMessage({
      type: 'TRANSLATE',
      payload: {
        messages: batch,
        language: 'pt' // Idioma alvo para tradução
      }
    });
    
    // Processa o próximo lote após um pequeno delay
    if (messageQueue.current.length > 0) {
      setTimeout(processQueue, 100);
    }
  }, [isWorkerReady]);

  // Adiciona mensagem à fila
  const addMessage = useCallback((message: Message) => {
    // Adiciona a mensagem imediatamente para feedback visual
    setMessages(prev => [...prev, message]);
    
    // Adiciona à fila para processamento em segundo plano
    messageQueue.current.push(message);
    
    // Inicia o processamento se não estiver em andamento
    if (!isProcessing.current) {
      processQueue();
    }
  }, [processQueue]);

  // Limpa todas as mensagens
  const clearMessages = useCallback(() => {
    setMessages([]);
    messageQueue.current = [];
  }, []);

  return {
    messages,
    addMessage,
    clearMessages,
  };
};

// Função auxiliar para criar o worker como string
function createWorkerString(): string {
  return `
    // Código do worker inline
    ${self.onmessage.toString()}
    ${translateText.toString()}
    ${processTranslationBatch.toString()}
    
    // Inicialização do worker
    self.onmessage = async function(e) {
      const { type, payload } = e.data;
      
      if (type === 'TRANSLATE') {
        try {
          const { messages, language } = payload;
          const results = await processTranslationBatch(messages, language);
          
          // Envia o resultado final
          self.postMessage({
            type: 'TRANSLATION_COMPLETE',
            data: results,
          });
        } catch (error) {
          self.postMessage({
            type: 'TRANSLATION_ERROR',
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
        }
      }
    };
  `;
}

// Funções do worker
async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang }),
    });

    if (!response.ok) {
      throw new Error('Erro na tradução');
    }

    const data = await response.json();
    return data.translatedText;
  } catch (error) {
    console.error('Erro ao traduzir texto:', error);
    throw error;
  }
}

async function processTranslationBatch(messages: TranslationMessage[], language: string): Promise<TranslationMessage[]> {
  const batchSize = 5;
  const results: TranslationMessage[] = [];
  
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    const batchPromises = batch.map(async (msg) => {
      try {
        if (typeof msg.message === 'string') {
          const translatedText = await translateText(msg.message, language);
          return {
            ...msg,
            translatedText
          };
        }
        return msg;
      } catch (error) {
        console.error('Erro ao processar mensagem:', error);
        return msg;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Envia atualizações parciais
    self.postMessage({
      type: 'PARTIAL_RESULT',
      data: batchResults,
    });
  }
  
  return results;
}

export default useChatMessages;
