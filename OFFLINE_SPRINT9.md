# Sprint 9 — PWA e Operação Offline

Implementado: Service Worker automático, instalação PWA, cache de ativos e fila IndexedDB para eventos de campo, mudanças de status e checklist. Quando a conexão retorna, a fila tenta sincronizar automaticamente.

Limitação intencional: arquivos/fotos não entram na fila nesta versão porque o armazenamento offline de blobs e a retomada de upload precisam de controle adicional de tamanho e conflito. O próximo incremento pode adicionar uma fila de evidências com IndexedDB.
