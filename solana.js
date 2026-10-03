// Integração real com a Solana devnet (Memo Program).
// Gravamos na chain apenas o HASH da credencial. Dados pessoais ficam fora (LGPD).
(function () {
  const W = window.solanaWeb3;
  const MEMO_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
  const RPC = 'https://api.devnet.solana.com';
  const KEY = 'persiste_issuer_v1';
  let conn = null, kp = null, phantom = null;

  function connection() { if (!conn) conn = new W.Connection(RPC, 'confirmed'); return conn; }

  function issuerKeypair() {
    if (kp) return kp;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { kp = W.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw))); return kp; }
    } catch (e) {}
    kp = W.Keypair.generate();
    try { localStorage.setItem(KEY, JSON.stringify(Array.from(kp.secretKey))); } catch (e) {}
    return kp;
  }

  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function issuerAddress() { return phantom ? phantom.toBase58() : issuerKeypair().publicKey.toBase58(); }

  async function connectPhantom() {
    const p = (window.phantom && window.phantom.solana) || window.solana;
    if (!p || !p.isPhantom) throw new Error('Phantom não encontrada. Instale a extensão ou use a carteira da instituição.');
    const r = await p.connect();
    phantom = r.publicKey;
    window.__phantom = p;
    return phantom.toBase58();
  }

  async function balance() {
    const lam = await connection().getBalance(new W.PublicKey(issuerAddress()));
    return lam / W.LAMPORTS_PER_SOL;
  }

  async function airdrop() {
    const sig = await connection().requestAirdrop(new W.PublicKey(issuerAddress()), W.LAMPORTS_PER_SOL);
    await connection().confirmTransaction(sig, 'confirmed');
    return sig;
  }

  // Grava o memo "persiste:v1:<hash>" na devnet e devolve a assinatura da transação.
  async function writeMemo(hash) {
    const c = connection();
    const payerKey = new W.PublicKey(issuerAddress());
    const ix = new W.TransactionInstruction({
      keys: [{ pubkey: payerKey, isSigner: true, isWritable: false }],
      programId: new W.PublicKey(MEMO_ID),
      data: new TextEncoder().encode('persiste:v1:' + hash),
    });
    const tx = new W.Transaction().add(ix);
    tx.feePayer = payerKey;
    const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    let sig;
    if (phantom && window.__phantom) {
      const res = await window.__phantom.signAndSendTransaction(tx);
      sig = res.signature;
    } else {
      tx.sign(issuerKeypair());
      sig = await c.sendRawTransaction(tx.serialize());
    }
    await c.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    return sig;
  }

  // Lê a transação de volta da chain e confere memo + assinante.
  async function readMemo(sig) {
    const t = await connection().getParsedTransaction(sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (!t) return null;
    const ix = t.transaction.message.instructions.find((i) => i.programId && i.programId.toBase58() === MEMO_ID);
    const memo = ix ? (typeof ix.parsed === 'string' ? ix.parsed : null) : null;
    const signer = t.transaction.message.accountKeys[0].pubkey.toBase58();
    return { memo, signer, blockTime: t.blockTime, slot: t.slot };
  }

  window.SOL = { sha256Hex, issuerAddress, connectPhantom, balance, airdrop, writeMemo, readMemo,
    explorer: (sig) => 'https://explorer.solana.com/tx/' + sig + '?cluster=devnet',
    explorerAddr: (a) => 'https://explorer.solana.com/address/' + a + '?cluster=devnet',
    usingPhantom: () => !!phantom };
})();
