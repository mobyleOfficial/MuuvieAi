---
date: 2026-11-10
author: Bruno Bacelar Abe
status: draft
related:
  - research/features/movie-universe/roadmap.md
  - research/features/movie-universe/spike.md
tags: [backend, frontend, recommendations, embeddings, flutter, 3d, exploration]
---

# Universo de Filmes — Fase 6 (exploratória)

## Executive Summary

A Fase 6 do roadmap pede duas avaliações sem compromisso de entrega: similaridade semântica por embeddings de sinopse e uma reavaliação do 3D real [Source: research/features/movie-universe/roadmap.md, "Fase 6 — Exploratório"].

**Embeddings:** vale um experimento, mas como mais um sinal do `SimilarityScorer`, e não como substituto do `/similar` do TMDB. Recomendação: um modelo local multilíngue de 384 dimensões, rodando no backend via ONNX, e vetores no Postgres com pgvector. Isso só deve virar produto se um teste cego mostrar ganho sobre o score atual.

**3D real:** continua adiado. O `flutter_scene` já roda no Flutter 3.47 estável, mas exige ligar o Flutter GPU por plataforma e se declara pré-1.0, com quebras entre versões menores. O 2.5D em Flame passou em todos os gates de desempenho.

## Problem Statement

Hoje a distância de um planeta à estrela vem de três sinais: a ordem do TMDB, os gêneros em comum e as keywords em comum [Source: backend/src/main/kotlin/org/mobyle/domain/usecase/movies/SimilarityScorer.kt]. Esse score tem dois limites:

- **Filmes ainda não enriquecidos** ficam só com a ordem do TMDB, em torno de 0,5 [Source: roadmap.md, "Fase 3", status]. Desde a Fase 5 eles passam na frente da fila de enriquecimento [Source: backend/src/main/kotlin/org/mobyle/data/service/MovieEnrichmentService.kt, `enrichAhead`], mas isso só melhora a próxima visita ao sistema.
- **Keywords do TMDB são esparsas e literais.** Duas sinopses sobre luto contadas de formas diferentes não dividem nenhuma keyword. Analysis: é aí que um embedding de sinopse acrescenta informação que os sinais atuais não têm.

O 3D foi rejeitado na fase de opções porque o Flutter GPU era experimental [Source: roadmap.md, "Opção 3"]. Como o Flutter avançou desde então, a pergunta foi reaberta.

Fora de escopo: recomendação personalizada por histórico do usuário e qualquer modelo generativo.

## Options Evaluated — Similaridade semântica

Analysis: as sinopses já estão no catálogo, na coluna `movies.overview`, gravada pelo enriquecimento [Source: backend/src/main/kotlin/org/mobyle/data/local/movies/MovieCatalogDataSourceImpl.kt, lines 87, 107, 131]. O pedido de detalhe ao TMDB não passa `language` [Source: backend/src/main/kotlin/org/mobyle/data/remote/tmdb/TmdbDataSourceImpl.kt, lines 18-21], então na maioria vêm no idioma padrão do TMDB. Para filmes importados do Filmow, porém, a sinopse pode estar em português, então o modelo precisa entender os dois idiomas.

### Opção A: Modelo local no backend (ONNX) + pgvector
**Description**: Gerar o embedding da sinopse no próprio backend com um modelo pequeno de sentence-transformers exportado em ONNX, no momento do enriquecimento. Os vetores ficam numa coluna `vector(384)` do Postgres com índice HNSW de cosseno.

**Pros**:
- O `paraphrase-multilingual-MiniLM-L12-v2` gera vetores de 384 dimensões, cobre 50 idiomas e é Apache-2.0 [Source: https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2].
- Há versões ONNX prontas, inclusive quantizadas [Source: https://huggingface.co/Qdrant/paraphrase-multilingual-MiniLM-L12-v2-onnx-Q].
- O pgvector faz busca por cosseno com o operador `<=>` e índice `hnsw (embedding vector_cosine_ops)`, e suporta Postgres 13 ou mais novo [Source: https://github.com/pgvector/pgvector]. O backend já usa Postgres 16 [Source: backend/docker-compose.yml, line 3].
- Sem custo por chamada e sem enviar dados a terceiros.

**Cons**:
- O modelo lê no máximo 128 tokens [Source: https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2], então sinopses longas são cortadas.
- A imagem oficial `postgres` não vem com o pgvector: é preciso a imagem `pgvector/pgvector` ou instalar a extensão [Source: https://github.com/pgvector/pgvector]. Isso afeta o deploy e o Postgres embutido dos testes.
- O modelo (algumas centenas de MB) passa a viver no processo do backend.

**Verdict**: Recomendada para o experimento: é barata, privada e encaixa no enriquecimento que já existe.

### Opção B: API de embeddings hospedada
**Description**: Pedir os vetores a um provedor externo durante o enriquecimento e guardá-los do mesmo jeito, no pgvector.

**Pros**:
- Modelos maiores e janelas de contexto longas, sem nada rodando no backend.

**Cons**:
- Custo por chamada e mais um segredo para gerenciar. Analysis: o catálogo cresce a cada import do Filmow, então o custo acompanha o uso.
- As sinopses saem para terceiros.

**Verdict**: Rejeitada para o experimento. Pode ser reavaliada se o modelo local se mostrar fraco.

### Opção C: Embeddings no app
**Description**: Calcular a similaridade no aparelho.

**Pros**:
- Nenhuma mudança no backend.

**Cons**:
- O app só conhece os 10 similares de cada sistema [Source: backend/src/main/kotlin/org/mobyle/data/remote/tmdb/Mappers.kt, line 94], então não tem o catálogo para comparar. Também pesaria o app.

**Verdict**: Rejeitada.

## Options Evaluated — 3D real

### Opção D: Migrar o mapa para `flutter_scene`
**Description**: Trocar o 2.5D em Flame por uma cena 3D renderizada pelo Flutter GPU.

**Pros**:
- O `flutter_scene` agora roda no Flutter 3.47 estável, em iOS, Android, desktop e web, e no web usa WebGL2 sem flag [Source: https://pub.dev/documentation/flutter_scene/latest/]. O app já está no Flutter 3.47 [Source: research/features/movie-universe/spike.md, "Método"].

**Cons**:
- O Flutter GPU precisa ser ligado em cada plataforma, por flag ou chave no manifesto [Source: https://pub.dev/documentation/flutter_scene/latest/], e a documentação oficial ainda o chama de *early preview*, sem garantia de API [Source: https://flutter.googlesource.com/mirrors/flutter/+/HEAD/docs/engine/impeller/Flutter-GPU.md].
- O `flutter_scene` é pré-1.0 e pode quebrar em versões menores [Source: https://pub.dev/documentation/flutter_scene/latest/].
- Reescreveria o mapa inteiro: órbitas em malha, streaming, selos, constelações e testes.

**Verdict**: Rejeitada por agora.

### Opção E: Manter Flame 2.5D e aprofundar a sensação de espaço
**Description**: Continuar no Flame e acrescentar profundidade com parallax e escala.

**Pros**:
- Já mede 60 fps no aparelho de referência em todas as fases, inclusive na exploração longa [Source: research/features/movie-universe/spike.md].

**Cons**:
- Não é 3D de verdade.

**Verdict**: Escolhida.

## Recommended Approach

### Similaridade semântica (experimento, ~1 semana)

1. **Dados:** adicionar `movie_embeddings (movie_id, model, embedding vector(384))` numa migração que roda `CREATE EXTENSION vector`. Trocar a imagem do banco para `pgvector/pgvector:pg16` no `docker-compose.yml` e no Postgres embutido dos testes.
2. **Geração:** no fim do `enrichFromTmdb`, gerar o embedding da sinopse com ONNX Runtime. Um backfill em lotes cobre o catálogo já enriquecido, com o mesmo espaçamento do enriquecimento.
3. **Sinal novo:** o `SimilarityScorer` ganha um quarto sinal, a similaridade de cosseno entre as sinopses (`1 - (a <=> b)`), contado só quando os dois filmes têm vetor, como os sinais atuais. O peso inicial é 0,25, com os outros reescalados.
4. **Avaliação:** um teste cego interno com cerca de 30 filmes de origem. Para cada um, duas ordens das órbitas (score atual e score com sinopse) sem saber qual é qual. O sinal entra no produto se ganhar em pelo menos 60% dos casos.

```kotlin
// One more signal, counted only when both movies have a vector, like genres and keywords.
if (source.embedding != null && similar.embedding != null) {
    add(synopsisWeight to cosine(source.embedding, similar.embedding))
}
```

**Critério de sucesso:** o teste cego e nenhum aumento perceptível na latência de `GET /movies/{id}/similar`. São 11 vetores por chamada, lidos junto com os traits.

**Riscos:** a imagem do banco muda (deploy e testes) e o backend fica maior. Sinopses curtas ou vazias não geram vetor, e esses filmes caem nos sinais atuais.

### 3D

Ficar no Flame. Reabrir quando o Flutter GPU sair do *preview* na documentação oficial e o `flutter_scene` chegar à 1.0.

## Alternative Approaches

- **Trocar o `/similar` por vizinhos semânticos do catálogo inteiro (k-NN no pgvector):** o universo deixaria de depender da lista do TMDB e poderia ter mais de 10 planetas por sistema. Ficou de fora porque mudaria a natureza das órbitas e a fileira "Filmes Similares" do detalhe. É o próximo passo natural se o experimento for bem.
- **`/recommendations` do TMDB:** continua em aberto, como no roadmap [Source: roadmap.md, "Alternative Approaches"].

## Next Steps

- [ ] Decidir se o experimento de embeddings entra no próximo ciclo (decision gate: Bruno).
- [ ] Rodar o experimento com uma `TMDB_API_KEY` válida no ambiente. Ela não estava disponível nesta sessão, então não houve protótipo com sinopses reais.
- [ ] Reavaliar o 3D quando o Flutter GPU sair do *preview*.
