# Persiste

Radar de evasão universitária + credenciais verificáveis na Solana. Projeto do 3º WoHackathon (Track 02, Vida Universitária).

## Como rodar
Site estático, sem build. Abra `index.html` ou publique no GitHub Pages (Settings > Pages > branch main, pasta root).
Com servidor local: `python3 -m http.server 8000`.

## O que é real e o que é simulado
- **Real (Solana devnet):** a emissão grava o hash SHA-256 da credencial via Memo Program. A página de verificação lê a transação da chain, recalcula o hash e confere o memo e a assinatura da emissora.
- **Simulado:** alunos e notas (dados fictícios), ranking, bolsa em USDC, revogação (registro local), assistente de chat (regras, sem LLM).
- **Não usamos programa próprio (smart contract) nem NFT.** Roadmap: token não transferível (Token-2022) e escrow de USDC em Anchor.
- Dados pessoais ficam fora da chain. Só o hash é gravado.

## Fluxo da demo
1. Aluno (Marina) > Jornada > "Simular conclusão de marco".
2. Coordenador > Marina > "Emitir credencial na Solana" (a carteira da instituição precisa de SOL de teste: botão de airdrop ou faucet.solana.com).
3. Aluno > Carteira > "QR / Compartilhar" > abrir o link: verificação on-chain.
4. Aluno > Ranking: ativar visibilidade com apelido. Empresa > Portal: ver o talento e verificar.
