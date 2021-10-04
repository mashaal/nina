const anchor = require('@project-serum/anchor');
const { Token, TOKEN_PROGRAM_ID } = require("@solana/spl-token");

const assert = require("assert");

const encrypt = require('./utils/encrypt');

const {
  sleep,
  getTokenAccount,
  createMint,
  createMintInstructions,
  createTokenAccount,
  mintToAccount,
  findOrCreateAssociatedTokenAccount,
  bnToDecimal,
  newAccount,
  wrapSol,
} = require("./utils");

let nina = anchor.workspace.Nina;
let provider = anchor.Provider.env();

//Users
let user1;
let user2;
let vault;

// Mints
let usdcMint;
let wrappedSolMint = new anchor.web3.PublicKey('So11111111111111111111111111111111111111112');
let releaseMint;
let releaseMint2;
let releaseMint3;

// Accounts
let release;
let releaseSigner;
let release2;
let releaseSigner2;
let release3;
let releaseSigner3;
let vaultUsdcTokenAccount;
let vaultWrappedSolTokenAccount;
let vaultSigner;
let usdcTokenAccount;
let royaltyTokenAccount;
let royaltyTokenAccount2;
let royaltyTokenAccount3;
let purchaserReleaseTokenAccount;
let user2UsdcTokenAccount;
let authorityReleaseTokenAccount;
let authorityReleaseTokenAccount2;
let user1UsdcTokenAccount;
let wrappedSolTokenAccount;
let user1WrappedSolTokenAccount;
let purchaserReleaseTokenAccount2;
let wrongReleaseTokenAccount;

// Misc
let releasePrice = 10000000;
let expectedAmountExchangeSellOffer = 5000000;
let initializerAmount = 5000000;

describe('Init', async () => {
  it('Set up USDC Mint + Users', async () => {
    user1 = await newAccount(provider);
    user2 = await newAccount(provider);
    usdcMint = await createMint(provider, provider.wallet.publicKey, 6);
    
    const [_usdcTokenAccount, usdcTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      provider.wallet.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      usdcMint,
    );
    usdcTokenAccount = _usdcTokenAccount;

    const [_wrappedSolTokenAccount, wrappedSolTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      provider.wallet.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      wrappedSolMint,
    );
    wrappedSolTokenAccount = _wrappedSolTokenAccount;

    const [_user1UsdcTokenAccount, user1UsdcTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      user1.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      usdcMint,
    );
    user1UsdcTokenAccount = _user1UsdcTokenAccount;

    const [_user1WrappedSolTokenAccount, user1WrappedSolTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      user1.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      wrappedSolMint,
    );
    user1WrappedSolTokenAccount = _user1WrappedSolTokenAccount;

    const tx = new anchor.web3.Transaction();
    tx.add(usdcTokenAccountIx, user1UsdcTokenAccountIx, wrappedSolTokenAccountIx,user1WrappedSolTokenAccountIx);
    await provider.send(tx, []);

    await mintToAccount(
      provider,
      usdcMint,
      usdcTokenAccount,
      new anchor.BN(100000000),
      provider.wallet.publicKey,
    );

    await mintToAccount(
      provider,
      usdcMint,
      user1UsdcTokenAccount,
      new anchor.BN(100000000),
      provider.wallet.publicKey,
    );

  });

  it('Creates Vault and adds authority', async () => {
    const [_vault, vaultBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("nina-vault"))],
      nina.programId
    );
    vault = _vault;

    const [_vaultSigner, vaultSignerBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-vault-signer")),
        vault.toBuffer()
      ],
      nina.programId
    );
    vaultSigner = _vaultSigner;

    const [usdcVault, usdcVaultBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-vault-token")),
        vault.toBuffer(),
        usdcMint.toBuffer()
      ],
      nina.programId
    );
    vaultUsdcTokenAccount = usdcVault;

    const [wrappedSolVault, wrappedSolVaultBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-vault-token")),
        vault.toBuffer(),
        wrappedSolMint.toBuffer()
      ],
      nina.programId
    );
    vaultWrappedSolTokenAccount = wrappedSolVault;

    const bumps = {
      vault,
      signer: vaultSignerBump,
      usdc: usdcVaultBump,
      wsol: wrappedSolVaultBump,
    };

    await nina.rpc.vaultInit(bumps, {
      accounts: {
        vault,
        vaultSigner,
        usdcVault,
        wrappedSolVault,
        usdcMint,
        wrappedSolMint,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
    });

    const vaultAfter = await nina.account.vault.fetch(vault);
    assert.ok(vaultAfter.authority.equals(provider.wallet.publicKey));
    assert.ok(vaultAfter.vaultSigner.equals(vaultSigner));
    assert.ok(vaultAfter.usdcVault.equals(usdcVault));
    assert.ok(vaultAfter.wrappedSolVault.equals(wrappedSolVault));
  });

  it('Fails when trying init another vault', async () => {

    const [vault2, vaultBump2] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("nina-vault2"))],
      nina.programId
    );

    const [vaultSigner2, vaultSignerBump2] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-vault-signer")),
        vault2.toBuffer()
      ],
      nina.programId
    );

    const [usdcVault2, usdcVaultBump2] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-vault-token")),
        vault2.toBuffer(),
        usdcMint.toBuffer()
      ],
      nina.programId
    );

    const [wrappedSolVault2, wrappedSolVaultBump2] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-vault-token")),
        vault2.toBuffer(),
        wrappedSolMint.toBuffer()
      ],
      nina.programId
    );

    const bumps = {
      vault: vaultBump2,
      signer: vaultSignerBump2,
      usdc: usdcVaultBump2,
      wsol: wrappedSolVaultBump2,
    };

    await assert.rejects(
      async () => {
        await nina.rpc.vaultInit(bumps, {
          accounts: {
            vault: vault2,
            vaultSigner: vaultSigner2,
            usdcVault: usdcVault2,
            wrappedSolVault: wrappedSolVault2,
            usdcMint,
            wrappedSolMint,
            authority: provider.wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          },
        })
      },
      (err) => {
        assert.ok(err.toString().includes("Cross-program invocation with unauthorized signer or writable account"));
        return true;
      }
    );
  });

});

describe('Release', async () => {
  it('Initialize Release For Sale in USDC', async () => {
    const paymentMint = usdcMint;
    releaseMint = anchor.web3.Keypair.generate();
    const releaseMintIx = await createMintInstructions(
      provider,
      provider.wallet.publicKey,
      releaseMint.publicKey,
      0,
    );

    const [_release, releaseBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-release")),
        releaseMint.publicKey.toBuffer(),
      ],
      nina.programId,
    );
    release = _release;

    const [_releaseSigner, releaseSignerBump] = await anchor.web3.PublicKey.findProgramAddress(
      [release.toBuffer()],
      nina.programId,
    );
    releaseSigner = _releaseSigner;

    let [_authorityReleaseTokenAccount, authorityReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      provider.wallet.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMint.publicKey,
      false,
      true,
    );
    authorityReleaseTokenAccount = _authorityReleaseTokenAccount;

    let [_royaltyTokenAccount, royaltyTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      releaseSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      paymentMint,
    );
    royaltyTokenAccount = _royaltyTokenAccount;

    let [vaultTokenAccount, vaultTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      vaultSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMint.publicKey,
      false,
      true,
    );

    const config = {
      amountTotalSupply: new anchor.BN(1000),
      amountToArtistTokenAccount: new anchor.BN(20),
      amountToVaultTokenAccount: new anchor.BN(13),
      resalePercentage: new anchor.BN(200000),
      price: new anchor.BN(releasePrice),
      releaseDatetime: new anchor.BN((Date.now() / 1000) - 5),
    };

    const bumps = {
      release: releaseBump,
      signer: releaseSignerBump,
    }

    await nina.rpc.releaseInitProtected(
      config,
      bumps, {
        accounts: {
          release,
          releaseSigner,
          releaseMint: releaseMint.publicKey,
          payer: provider.wallet.publicKey,
          authority: provider.wallet.publicKey,
          authorityTokenAccount: usdcTokenAccount,
          authorityReleaseTokenAccount,
          paymentMint,
          vaultTokenAccount,
          vault: vault,
          royaltyTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [releaseMint],
        instructions: [
          ...releaseMintIx,
          authorityReleaseTokenAccountIx,
          royaltyTokenAccountIx,
          vaultTokenAccountIx,
        ],
      }
    );

    const releaseAfter = await nina.account.release.fetch(release);
    assert.ok(releaseAfter.remainingSupply.toNumber() === 967);
    assert.equal(bnToDecimal(releaseAfter.resalePercentage.toNumber()), .2)
    assert.equal(bnToDecimal(releaseAfter.royaltyRecipients[0].percentShare.toNumber()), 1)

    const authorityReleaseTokenAccountAfter = await getTokenAccount(
      provider,
      authorityReleaseTokenAccount,
    );
    assert.ok(authorityReleaseTokenAccountAfter.amount.toNumber() === 20)

    const vaultTokenAccountAfter = await getTokenAccount(
      provider,
      vaultTokenAccount,
    );

    assert.ok(vaultTokenAccountAfter.amount.toNumber() === 13)
  });

  it('Initialize Release For Sale in wSOL', async () => {
    const paymentMint = wrappedSolMint;
    releaseMint2 = anchor.web3.Keypair.generate();
    const releaseMintIx = await createMintInstructions(
      provider,
      provider.wallet.publicKey,
      releaseMint2.publicKey,
      0,
    );

    const [_release, releaseBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-release")),
        releaseMint2.publicKey.toBuffer(),
      ],
      nina.programId,
    );
    release2 = _release;

    const [_releaseSigner, releaseSignerBump] = await anchor.web3.PublicKey.findProgramAddress(
      [release2.toBuffer()],
      nina.programId,
    );
    releaseSigner2 = _releaseSigner;

    let [_authorityReleaseTokenAccount, authorityReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      provider.wallet.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMint2.publicKey,
      false,
      true,
    );
    authorityReleaseTokenAccount2 = _authorityReleaseTokenAccount;

    let [_royaltyTokenAccount, royaltyTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      releaseSigner2,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      paymentMint,
    );
    royaltyTokenAccount2 = _royaltyTokenAccount;

    let [vaultTokenAccount2, vaultTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      vaultSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMint2.publicKey,
      false,
      true,
    );

    const config = {
      amountTotalSupply: new anchor.BN(1000),
      amountToArtistTokenAccount: new anchor.BN(20),
      amountToVaultTokenAccount: new anchor.BN(13),
      resalePercentage: new anchor.BN(200000),
      price: new anchor.BN(releasePrice),
      releaseDatetime: new anchor.BN((Date.now() / 1000) - 5),
    };

    const bumps = {
      release: releaseBump,
      signer: releaseSignerBump,
    }

    await nina.rpc.releaseInitProtected(
      config,
      bumps, {
        accounts: {
          release: release2,
          releaseSigner: releaseSigner2,
          releaseMint: releaseMint2.publicKey,
          payer: provider.wallet.publicKey,
          authority: provider.wallet.publicKey,
          authorityTokenAccount: wrappedSolTokenAccount,
          authorityReleaseTokenAccount:authorityReleaseTokenAccount2,
          paymentMint,
          vault,
          vaultTokenAccount: vaultTokenAccount2,
          royaltyTokenAccount:royaltyTokenAccount2,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [releaseMint2],
        instructions: [
          ...releaseMintIx,
          authorityReleaseTokenAccountIx,
          royaltyTokenAccountIx,
          vaultTokenAccountIx,
        ],
      }
    );

    const releaseAfter = await nina.account.release.fetch(release2);
    assert.ok(releaseAfter.remainingSupply.toNumber() === 967);
    assert.equal(bnToDecimal(releaseAfter.resalePercentage.toNumber()), .2)
    assert.equal(bnToDecimal(releaseAfter.royaltyRecipients[0].percentShare.toNumber()), 1)

    const authorityReleaseTokenAccount2After = await getTokenAccount(
      provider,
      authorityReleaseTokenAccount2,
    );
    assert.ok(authorityReleaseTokenAccount2After.amount.toNumber() === 20)

    const vaultTokenAccount2After = await getTokenAccount(
      provider,
      vaultTokenAccount2,
    );

    assert.ok(vaultTokenAccount2After.amount.toNumber() === 13)
  })

  it("Purchases a release with USDC", async () => {
    const usdcTokenAccountBefore = await getTokenAccount(
      provider,
      user1UsdcTokenAccount,
    );
    const usdcTokenAccountBeforeBalanceTx = usdcTokenAccountBefore.amount.toNumber();

    let [_purchaserReleaseTokenAccount, purchaserReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      user1.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMint.publicKey,
    );
    purchaserReleaseTokenAccount = _purchaserReleaseTokenAccount;

    await nina.rpc.releasePurchase(
      new anchor.BN(releasePrice), {
        accounts: {
          release,
          releaseSigner,
          payer: user1.publicKey,
          payerTokenAccount: user1UsdcTokenAccount,
          purchaser: user1.publicKey,
          purchaserReleaseTokenAccount,
          royaltyTokenAccount,
          releaseMint: releaseMint.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        },
        signers: [user1],
        instructions: [purchaserReleaseTokenAccountIx],
      }
    );

    const purchaserReleaseTokenAccountAfter = await getTokenAccount(
      provider,
      purchaserReleaseTokenAccount,
    );
    assert.ok(purchaserReleaseTokenAccountAfter.amount.toNumber() === 1)

    const usdcTokenAccountAfter = await getTokenAccount(
      provider,
      user1UsdcTokenAccount,
    );
    assert.ok(usdcTokenAccountAfter.amount.toNumber() === usdcTokenAccountBeforeBalanceTx - releasePrice)

    const releaseAfter = await nina.account.release.fetch(release);
    assert.ok(releaseAfter.remainingSupply.toNumber() === 966);

    assert.equal(releaseAfter.saleCounter.toNumber(), 1);
    assert.equal(releaseAfter.totalCollected.toNumber(), releasePrice);

    const royaltyTokenAccountAfter = await getTokenAccount(
      provider,
      releaseAfter.royaltyTokenAccount,
    );
    assert.equal(royaltyTokenAccountAfter.amount.toNumber(), releasePrice);
  });

  it("Purchases a release with wSOL", async () => {
    const solBeforeBalance = await provider.connection.getBalance(user1.publicKey);

    let [_purchaserReleaseTokenAccount2, purchaserReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      user1.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMint2.publicKey,
    );
    purchaserReleaseTokenAccount2 = _purchaserReleaseTokenAccount2;

    const {instructions, signers} = await wrapSol(
      provider,
      user1,
      new anchor.BN(releasePrice),
    );

    await nina.rpc.releasePurchase(
      new anchor.BN(releasePrice), {
        accounts: {
          release: release2,
          releaseMint: releaseMint2.publicKey,
          releaseSigner: releaseSigner2,
          payer: user1.publicKey,
          payerTokenAccount: signers[0].publicKey,
          purchaser: user1.publicKey,
          purchaserReleaseTokenAccount: purchaserReleaseTokenAccount2,
          royaltyTokenAccount: royaltyTokenAccount2,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        },
        signers: [user1, ...signers],
        instructions: [
          ...instructions,
          purchaserReleaseTokenAccountIx,
        ],
      }
    );

    const purchaserReleaseTokenAccountAfter = await getTokenAccount(
      provider,
      purchaserReleaseTokenAccount,
    );
    assert.ok(purchaserReleaseTokenAccountAfter.amount.toNumber() === 1)

    const solAfterBalance = await provider.connection.getBalance(user1.publicKey);
    assert.equal(solAfterBalance, solBeforeBalance - releasePrice);

    const releaseAfter = await nina.account.release.fetch(release);
    assert.ok(releaseAfter.remainingSupply.toNumber() === 966)

    assert.equal(releaseAfter.saleCounter.toNumber(), 1)
    assert.equal(releaseAfter.totalCollected.toNumber(), releasePrice)

    const royaltyTokenAccountAfter = await getTokenAccount(
      provider,
      releaseAfter.royaltyTokenAccount,
    );
    assert.equal(royaltyTokenAccountAfter.amount.toNumber(), releasePrice)
  });

  it("Purchases a second release with wSOL", async () => {
    const solBeforeBalance = await provider.connection.getBalance(user1.publicKey);

    let [_purchaserReleaseTokenAccount2, purchaserReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      user1.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMint2.publicKey,
    );
    purchaserReleaseTokenAccount2 = _purchaserReleaseTokenAccount2;

    const {instructions, signers} = await wrapSol(
      provider,
      user1,
      new anchor.BN(releasePrice),
    );

    await nina.rpc.releasePurchase(
      new anchor.BN(releasePrice), {
        accounts: {
          release: release2,
          releaseMint: releaseMint2.publicKey,
          releaseSigner: releaseSigner2,
          payer: user1.publicKey,
          payerTokenAccount: signers[0].publicKey,
          purchaser: user1.publicKey,
          purchaserReleaseTokenAccount: purchaserReleaseTokenAccount2,
          royaltyTokenAccount: royaltyTokenAccount2,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        },
        signers: [user1, ...signers],
        instructions: [
          ...instructions,
        ],
      }
    );

    const purchaserReleaseTokenAccountAfter = await getTokenAccount(
      provider,
      purchaserReleaseTokenAccount,
    );
    assert.ok(purchaserReleaseTokenAccountAfter.amount.toNumber() === 1)

    const solAfterBalance = await provider.connection.getBalance(user1.publicKey);
    assert.equal(solAfterBalance, solBeforeBalance - releasePrice);

    const releaseAfter = await nina.account.release.fetch(release);
    assert.ok(releaseAfter.remainingSupply.toNumber() === 966)

    assert.equal(releaseAfter.saleCounter.toNumber(), 1)
    assert.equal(releaseAfter.totalCollected.toNumber(), releasePrice)

    const royaltyTokenAccountAfter = await getTokenAccount(
      provider,
      releaseAfter.royaltyTokenAccount,
    );
    assert.equal(royaltyTokenAccountAfter.amount.toNumber(), releasePrice)
  });

  it('Fails to purchase a release if not sent enough USDC', async () => {
    await assert.rejects(
      async () => {
        await nina.rpc.releasePurchase(new anchor.BN(500), {
          accounts: {
            release,
            releaseSigner,
            payer: user1.publicKey,
            payerTokenAccount: user1UsdcTokenAccount,
            purchaser: user1.publicKey,
            purchaserReleaseTokenAccount,
            royaltyTokenAccount,
            releaseMint: releaseMint.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          },
          signers:[user1],
        })
      },
      (err) => {
        assert.equal(err.code, 300);
        assert.equal(err.msg, "Amount sent does not match price");
        return true;
      }
    );
  });

  it('Will airdrop a release', async () => {

    const releaseBefore = await nina.account.release.fetch(release);

    const newUser = await newAccount(provider);
    let [recipientReleaseTokenAccount, recipientReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      newUser.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMint.publicKey,
    );
    
    await nina.rpc.releaseAirdrop({
      accounts: {
        release,
        releaseSigner,
        payer: provider.wallet.publicKey,
        recipient: newUser.publicKey,
        recipientReleaseTokenAccount,
        releaseMint: releaseMint.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      instructions:[recipientReleaseTokenAccountIx],
    })

    const releaseAfter = await nina.account.release.fetch(release);
    assert.ok(releaseAfter.remainingSupply.toNumber() === releaseBefore.remainingSupply.toNumber() - 1);

    const recipientReleaseTokenAccountAfter = await getTokenAccount(
      provider,
      recipientReleaseTokenAccount,
    );
    assert.ok(recipientReleaseTokenAccountAfter.amount.toNumber() === 1)
  });

  it('Fails to airdrop a release with wrong authority', async () => {

    const newUser = await newAccount(provider);
    let [recipientReleaseTokenAccount, recipientReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      newUser.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMint.publicKey,
    );

    await assert.rejects(
      async () => {
        await nina.rpc.releaseAirdrop({
          accounts: {
            release,
            releaseSigner,
            payer: newUser.publicKey,
            recipient: newUser.publicKey,
            recipientReleaseTokenAccount,
            releaseMint: releaseMint.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          },
          signers:[newUser],
          instructions:[recipientReleaseTokenAccountIx],
        })
      },
      (err) => {
        assert.equal(err.code, 143);
        assert.equal(err.msg, "A raw constraint was violated");
        return true;
      }
    );
  });

  it('Will not sell a release if sold out', async () => {
    const paymentMint = usdcMint;
    const releaseMintSellOut = anchor.web3.Keypair.generate();
    const releaseMintIx = await createMintInstructions(
      provider,
      provider.wallet.publicKey,
      releaseMintSellOut.publicKey,
      0,
    );

    const [releaseSellOut, releaseBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-release")),
        releaseMintSellOut.publicKey.toBuffer(),
      ],
      nina.programId,
    );

    const [releaseSignerSellOut, releaseSignerBump] = await anchor.web3.PublicKey.findProgramAddress(
      [releaseSellOut.toBuffer()],
      nina.programId,
    );

    let [authorityReleaseTokenAccountSellOut, authorityReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      provider.wallet.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMintSellOut.publicKey,
      false,
      true,
    );

    let [royaltyTokenAccountSellOut, royaltyTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      releaseSignerSellOut,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      paymentMint,
    );

    let [vaultTokenAccountSellOut, vaultTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      vaultSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMintSellOut.publicKey,
      false,
      true,
    );

    let [purchaserReleaseTokenAccountSellOut, purchaserReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      user1.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMintSellOut.publicKey,
    );

    const releasePriceSellout = new anchor.BN(100);
    const config = {
      amountTotalSupply: new anchor.BN(5),
      amountToArtistTokenAccount: new anchor.BN(0),
      amountToVaultTokenAccount: new anchor.BN(1),
      resalePercentage: new anchor.BN(200000),
      price: releasePriceSellout,
      releaseDatetime: new anchor.BN((Date.now() / 1000) - 5),
    };
    const bumps = {
      release: releaseBump,
      signer: releaseSignerBump,
    }

    await nina.rpc.releaseInitProtected(
      config,
      bumps, {
        accounts: {
          release: releaseSellOut,
          releaseSigner: releaseSignerSellOut,
          releaseMint: releaseMintSellOut.publicKey,
          payer: provider.wallet.publicKey,
          authority: provider.wallet.publicKey,
          authorityTokenAccount: usdcTokenAccount,
          authorityReleaseTokenAccount: authorityReleaseTokenAccountSellOut,
          paymentMint,
          vaultTokenAccount: vaultTokenAccountSellOut,
          vault,
          royaltyTokenAccount: royaltyTokenAccountSellOut,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [releaseMintSellOut],
        instructions: [
          ...releaseMintIx,
          authorityReleaseTokenAccountIx,
          royaltyTokenAccountIx,
          vaultTokenAccountIx,
          purchaserReleaseTokenAccountIx,
        ],
      }
    );

    const createGenerator = function*() {
      let i = 0;
      while(i < 5) {
        yield await Promise.resolve(i++);
      }
    }
    const generator = createGenerator();

    await assert.rejects(
      async () => {
        for await (let item of generator) {
          await nina.rpc.releasePurchase(
            releasePriceSellout, {
              accounts: {
                release: releaseSellOut,
                releaseSigner: releaseSignerSellOut,
                payer: user1.publicKey,
                payerTokenAccount: user1UsdcTokenAccount,
                purchaser: user1.publicKey,
                purchaserReleaseTokenAccount: purchaserReleaseTokenAccountSellOut,
                royaltyTokenAccount: royaltyTokenAccountSellOut,
                releaseMint: releaseMintSellOut.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
              },
              signers: [user1],
            }
          );
        }
      },
      (err) => {
        assert.equal(err.code, 306);
        assert.equal(err.msg, "Sold out");
        return true;
      }
    );
  });

  it('Will not sell a release if release date not live', async () => {
    const paymentMint = usdcMint;
    const releaseMintTest = anchor.web3.Keypair.generate();
    const releaseMintIx = await createMintInstructions(
      provider,
      provider.wallet.publicKey,
      releaseMintTest.publicKey,
      0,
    );
    releaseMint3 = releaseMintTest;

    const [releaseTest, releaseBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-release")),
        releaseMintTest.publicKey.toBuffer(),
      ],
      nina.programId,
    );
    release3 = releaseTest;

    const [releaseSignerTest, releaseSignerBump] = await anchor.web3.PublicKey.findProgramAddress(
      [releaseTest.toBuffer()],
      nina.programId,
    );
    releaseSigner3 = releaseSignerTest;

    let [authorityReleaseTokenAccountTest, authorityReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      provider.wallet.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMintTest.publicKey,
      false,
      true,
    );
    wrongReleaseTokenAccount = authorityReleaseTokenAccountTest;

    let [royaltyTokenAccountTest, royaltyTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      releaseSignerTest,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      paymentMint,
    );
    royaltyTokenAccount3 = royaltyTokenAccountTest;

    let [vaultTokenAccountTest, vaultTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      vaultSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMintTest.publicKey,
      false,
      true,
    );

    const releasePriceTest = new anchor.BN(100);
    const config = {
      amountTotalSupply: new anchor.BN(5),
      amountToArtistTokenAccount: new anchor.BN(1),
      amountToVaultTokenAccount: new anchor.BN(1),
      resalePercentage: new anchor.BN(200000),
      price: releasePriceTest,
      releaseDatetime: new anchor.BN((Date.now() / 1000) + 5),
    };
    const bumps = {
      release: releaseBump,
      signer: releaseSignerBump,
    }

    await nina.rpc.releaseInitProtected(
      config,
      bumps, {
        accounts: {
          release: releaseTest,
          releaseSigner: releaseSignerTest,
          releaseMint: releaseMintTest.publicKey,
          payer: provider.wallet.publicKey,
          authority: provider.wallet.publicKey,
          authorityTokenAccount: usdcTokenAccount,
          authorityReleaseTokenAccount: authorityReleaseTokenAccountTest,
          paymentMint,
          vaultTokenAccount: vaultTokenAccountTest,
          vault,
          royaltyTokenAccount: royaltyTokenAccountTest,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [releaseMintTest],
        instructions: [
          ...releaseMintIx,
          authorityReleaseTokenAccountIx,
          royaltyTokenAccountIx,
          vaultTokenAccountIx,
        ],
      }
    );

    await assert.rejects(
      async () => {
        let [purchaserReleaseTokenAccountTest, purchaserReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
          provider,
          user1.publicKey,
          anchor.web3.SystemProgram.programId,
          anchor.web3.SYSVAR_RENT_PUBKEY,
          releaseMintTest.publicKey,
        );

        await nina.rpc.releasePurchase(
          releasePriceTest, {
            accounts: {
              release: releaseTest,
              releaseSigner: releaseSignerTest,
              payer: user1.publicKey,
              payerTokenAccount: user1UsdcTokenAccount,
              purchaser: user1.publicKey,
              purchaserReleaseTokenAccount: purchaserReleaseTokenAccountTest,
              royaltyTokenAccount: royaltyTokenAccountTest,
              releaseMint: releaseMintTest.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            },
            signers: [user1],
            instructions: [purchaserReleaseTokenAccountIx],
          }
        );
      },
      (err) => {
        assert.equal(err.code, 311);
        assert.equal(err.msg, "Release is not live yet");
        return true;
      }
    );
  });

  it('Will not publish a release if vault fees and artist tokens greater than amount', async () => {
    const paymentMint = usdcMint;
    const releaseMintTest = anchor.web3.Keypair.generate();
    const releaseMintIx = await createMintInstructions(
      provider,
      provider.wallet.publicKey,
      releaseMintTest.publicKey,
      0,
    );

    const [releaseTest, releaseBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-release")),
        releaseMintTest.publicKey.toBuffer(),
      ],
      nina.programId,
    );

    const [releaseSignerTest, releaseSignerBump] = await anchor.web3.PublicKey.findProgramAddress(
      [releaseTest.toBuffer()],
      nina.programId,
    );

    let [authorityReleaseTokenAccountTest, authorityReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      provider.wallet.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMintTest.publicKey,
      false,
      true,
    );

    let [royaltyTokenAccountTest, royaltyTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      releaseSignerTest,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      paymentMint,
    );

    let [vaultTokenAccountTest, vaultTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      vaultSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMintTest.publicKey,
      false,
      true,
    );

    const releasePriceTest = new anchor.BN(100);
    const config = {
      amountTotalSupply: new anchor.BN(5),
      amountToArtistTokenAccount: new anchor.BN(6),
      amountToVaultTokenAccount: new anchor.BN(1),
      resalePercentage: new anchor.BN(200000),
      price: releasePriceTest,
      releaseDatetime: new anchor.BN((Date.now() / 1000) + 1000),
    };

    const bumps = {
      release: releaseBump,
      signer: releaseSignerBump,
    }

    await assert.rejects(
      async () => {
        await nina.rpc.releaseInitProtected(
          config,
          bumps, {
            accounts: {
              release: releaseTest,
              releaseSigner: releaseSignerTest,
              releaseMint: releaseMintTest.publicKey,
              payer: provider.wallet.publicKey,
              authority: provider.wallet.publicKey,
              authorityTokenAccount: usdcTokenAccount,
              authorityReleaseTokenAccount: authorityReleaseTokenAccountTest,
              paymentMint,
              vaultTokenAccount: vaultTokenAccountTest,
              vault,
              royaltyTokenAccount: royaltyTokenAccountTest,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [releaseMintTest],
            instructions: [
              ...releaseMintIx,
              authorityReleaseTokenAccountIx,
              royaltyTokenAccountIx,
              vaultTokenAccountIx,
            ],
          }
        );
      },
      (err) => {
        assert.equal(err.code, 307);
        assert.equal(err.msg, "Invalid amount to mint to artist on publish");
        return true;
      }
    );
  });

  it('Will not publish a release if via releaseInitProtected if payer !== Nina Publishing Account', async () => {
    const paymentMint = usdcMint;
    const releaseMintTest = anchor.web3.Keypair.generate();
    const releaseMintIx = await createMintInstructions(
      provider,
      user1.publicKey,
      releaseMintTest.publicKey,
      0,
    );

    const [releaseTest, releaseBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-release")),
        releaseMintTest.publicKey.toBuffer(),
      ],
      nina.programId,
    );

    const [releaseSignerTest, releaseSignerBump] = await anchor.web3.PublicKey.findProgramAddress(
      [releaseTest.toBuffer()],
      nina.programId,
    );

    let [authorityReleaseTokenAccountTest, authorityReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      user1.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMintTest.publicKey,
      false,
      true,
    );

    let [royaltyTokenAccountTest, royaltyTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      releaseSignerTest,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      paymentMint,
    );

    let [vaultTokenAccountTest, vaultTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      vaultSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMintTest.publicKey,
      false,
      true,
    );

    const releasePriceTest = new anchor.BN(100);
    const config = {
      amountTotalSupply: new anchor.BN(5),
      amountToArtistTokenAccount: new anchor.BN(0),
      amountToVaultTokenAccount: new anchor.BN(1),
      resalePercentage: new anchor.BN(200000),
      price: releasePriceTest,
      releaseDatetime: new anchor.BN((Date.now() / 1000)),
    };

    const bumps = {
      release: releaseBump,
      signer: releaseSignerBump,
    }

    await assert.rejects(
      async () => {
        await nina.rpc.releaseInitProtected(
          config,
          bumps, {
            accounts: {
              release: releaseTest,
              releaseSigner: releaseSignerTest,
              releaseMint: releaseMintTest.publicKey,
              payer: user1.publicKey,
              authority: user1.publicKey,
              authorityTokenAccount: user1UsdcTokenAccount,
              authorityReleaseTokenAccount: authorityReleaseTokenAccountTest,
              paymentMint,
              vaultTokenAccount: vaultTokenAccountTest,
              vault,
              royaltyTokenAccount: royaltyTokenAccountTest,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [releaseMintTest, user1],
            instructions: [
              ...releaseMintIx,
              authorityReleaseTokenAccountIx,
              royaltyTokenAccountIx,
              vaultTokenAccountIx,
            ],
          }
        );
      },
      (err) => {
        assert.equal(err.code, 152);
        assert.equal(err.msg, "An address constraint was violated");
        return true;
      }
    );
  });

  it('Will not publish a release if vault fees are incorrect', async () => {
    const paymentMint = usdcMint;
    const releaseMintTest = anchor.web3.Keypair.generate();
    const releaseMintIx = await createMintInstructions(
      provider,
      provider.wallet.publicKey,
      releaseMintTest.publicKey,
      0,
    );

    const [releaseTest, releaseBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("nina-release")),
        releaseMintTest.publicKey.toBuffer(),
      ],
      nina.programId,
    );

    const [releaseSignerTest, releaseSignerBump] = await anchor.web3.PublicKey.findProgramAddress(
      [releaseTest.toBuffer()],
      nina.programId,
    );

    let [authorityReleaseTokenAccountTest, authorityReleaseTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      provider.wallet.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMintTest.publicKey,
      false,
      true,
    );

    let [royaltyTokenAccountTest, royaltyTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      releaseSignerTest,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      paymentMint,
    );

    let [vaultTokenAccountTest, vaultTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      vaultSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMintTest.publicKey,
      false,
      true,
    );

    const releasePriceTest = new anchor.BN(100);
    const config = {
      amountTotalSupply: new anchor.BN(5),
      amountToArtistTokenAccount: new anchor.BN(6),
      amountToVaultTokenAccount: new anchor.BN(0),
      resalePercentage: new anchor.BN(200000),
      price: releasePriceTest,
      releaseDatetime: new anchor.BN((Date.now() / 1000) + 1000),
    };

    const bumps = {
      release: releaseBump,
      signer: releaseSignerBump,
    }

    await assert.rejects(
      async () => {
        await nina.rpc.releaseInitProtected(
          config,
          bumps, {
            accounts: {
              release: releaseTest,
              releaseSigner: releaseSignerTest,
              releaseMint: releaseMintTest.publicKey,
              payer: provider.wallet.publicKey,
              authority: provider.wallet.publicKey,
              authorityTokenAccount: usdcTokenAccount,
              authorityReleaseTokenAccount: authorityReleaseTokenAccountTest,
              paymentMint,
              vaultTokenAccount: vaultTokenAccountTest,
              vault,
              royaltyTokenAccount: royaltyTokenAccountTest,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [releaseMintTest],
            instructions: [
              ...releaseMintIx,
              authorityReleaseTokenAccountIx,
              royaltyTokenAccountIx,
              vaultTokenAccountIx,
            ],
          }
        );
      },
      (err) => {
        assert.equal(err.code, 308);
        assert.equal(err.msg, "Invalid Vault Fee Supplied");
        return true;
      }
    );
  });


});

describe("Revenue Share", async () => {
  it('Collects Revenue Share USDC', async () => {
    const usdcTokenAccountBefore = await getTokenAccount(
      provider,
      usdcTokenAccount,
    );
    const usdcTokenAccountBeforeBalance = usdcTokenAccountBefore.amount.toNumber(); 

    const royaltyTokenAccountBefore = await getTokenAccount(
      provider,
      royaltyTokenAccount,
    );
    const royaltyTokenAccountBeforeBalance = royaltyTokenAccountBefore.amount.toNumber(); 

    const releaseBefore = await nina.account.release.fetch(release);
    const royaltyRecipientOwedBefore = releaseBefore.royaltyRecipients[0].owed.toNumber();

    await nina.rpc.releaseRevenueShareCollect({
      accounts: {
        authority: provider.wallet.publicKey,
        authorityTokenAccount: usdcTokenAccount,
        release,
        releaseSigner,
        royaltyTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    });

    const releaseAfter = await nina.account.release.fetch(release);
    assert.equal(releaseAfter.royaltyRecipients[0].owed.toNumber(), 0);
    assert.equal(
      releaseAfter.royaltyRecipients[0].collected.toNumber(),
      royaltyRecipientOwedBefore,
    )

    const royaltyTokenAccountAfter = await getTokenAccount(
      provider,
      releaseAfter.royaltyTokenAccount,
    );
    assert.equal(royaltyTokenAccountAfter.amount.toNumber(), 0)

    const usdcTokenAccountAfter = await getTokenAccount(
      provider,
      usdcTokenAccount,
    );
    assert.equal(
      usdcTokenAccountAfter.amount.toNumber(),
      royaltyRecipientOwedBefore + usdcTokenAccountBeforeBalance
    );
  });

  it('Fails to collect Revenue Share if user is not authority', async () => {
    await assert.rejects(
      async () => {
        await nina.rpc.releaseRevenueShareCollect({
          accounts: {
            authority: user1.publicKey,
            authorityTokenAccount: user1UsdcTokenAccount,
            release,
            releaseSigner,
            royaltyTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [user1],
        });      
    },
      (err) => {
        assert.equal(err.code, 309);
        assert.equal(err.msg, "Invalid royalty recipient authority");
        return true;
      }
    );
  });

  it('Collects Revenue Share wSOL', async () => {
    const wrappedSolTokenAccountAfter = await getTokenAccount(
      provider,
      wrappedSolTokenAccount,
    );
    const wrappedSolTokenAccountBeforeBalance = wrappedSolTokenAccountAfter.amount.toNumber(); 

    let royaltyTokenAccountBefore = await getTokenAccount(
      provider,
      royaltyTokenAccount2,
    );
    const royaltyTokenAccount2BeforeBalance = royaltyTokenAccountBefore.amount.toNumber(); 

    const releaseBefore = await nina.account.release.fetch(release2);
    const royaltyRecipientOwedBefore = releaseBefore.royaltyRecipients[0].owed.toNumber();

    await nina.rpc.releaseRevenueShareCollect({
      accounts: {
        authority: provider.wallet.publicKey,
        authorityTokenAccount: wrappedSolTokenAccount,
        release: release2,
        releaseSigner: releaseSigner2,
        royaltyTokenAccount: royaltyTokenAccount2,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    });

    const releaseAfter = await nina.account.release.fetch(release2);
    assert.equal(releaseAfter.royaltyRecipients[0].owed.toNumber(), 0);
    assert.equal(
      releaseAfter.royaltyRecipients[0].collected.toNumber(),
      royaltyRecipientOwedBefore,
    );

    const royaltyTokenAccountAfter = await getTokenAccount(
      provider,
      releaseAfter.royaltyTokenAccount,
    );
    assert.equal(royaltyTokenAccountAfter.amount.toNumber(), 0);

    const wrappedSolTokenAccountAfter = await getTokenAccount(
      provider,
      wrappedSolTokenAccount,
    );
    assert.equal(
      wrappedSolTokenAccountAfter.amount.toNumber(),
      royaltyRecipientOwedBefore + wrappedSolTokenAccountBeforeBalance,
    );
  });

  it('Transfers Revenue Share', async () => {
    const releaseBefore = await nina.account.release.fetch(release);
    const royaltyRecipientPercentShareBeforeTx = releaseBefore.royaltyRecipients[0].percentShare.toNumber();

    const [_user2UsdcTokenAccount, user2UsdcTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      user2.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      usdcMint,
    );
    user2UsdcTokenAccount = _user2UsdcTokenAccount;

    const amountToTransfer = 250000;
    await nina.rpc.releaseRevenueShareTransfer(
      new anchor.BN(amountToTransfer), {
      accounts: {
        authority: provider.wallet.publicKey,
        authorityTokenAccount: usdcTokenAccount,
        release,
        releaseSigner,
        royaltyTokenAccount,
        newRoyaltyRecipient: user2.publicKey,
        newRoyaltyRecipientTokenAccount: user2UsdcTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      instructions: [user2UsdcTokenAccountIx]
    })

    const releaseAfter = await nina.account.release.fetch(release);
    assert.equal(
      releaseAfter.royaltyRecipients[0].percentShare.toNumber(),
      royaltyRecipientPercentShareBeforeTx - amountToTransfer,
    );
    assert.equal(
      releaseAfter.royaltyRecipients[1].percentShare.toNumber(),
      amountToTransfer,
    );
  });

  it('Fails to transfer Revenue Share if user doesnt have a share', async () => {
    const user3 = await newAccount(provider);
    const [user3UsdcTokenAccount, user3UsdcTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      user3.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      usdcMint,
    );

    const amountToTransfer = 1000;

    await assert.rejects(
      async () => {
        await nina.rpc.releaseRevenueShareTransfer(
          new anchor.BN(amountToTransfer), {
          accounts: {
            authority: user3.publicKey,
            authorityTokenAccount: user3UsdcTokenAccount,
            release,
            releaseSigner,
            royaltyTokenAccount,
            newRoyaltyRecipient: user2.publicKey,
            newRoyaltyRecipientTokenAccount: user2UsdcTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          },
          signers: [user3],
          instructions: [user3UsdcTokenAccountIx],
        })
      },
      (err) => {
        assert.equal(err.code, 309);
        assert.equal(err.msg, "Invalid royalty recipient authority");
        return true;
      }
    );
  });

  it('Fails to transfer Revenue Share if greater than users share', async () => {
    const amountToTransfer = 800000;

    await assert.rejects(
      async () => {
        await nina.rpc.releaseRevenueShareTransfer(
          new anchor.BN(amountToTransfer), {
          accounts: {
            authority: provider.wallet.publicKey,
            authorityTokenAccount: usdcTokenAccount,
            release,
            releaseSigner,
            royaltyTokenAccount,
            newRoyaltyRecipient: user2.publicKey,
            newRoyaltyRecipientTokenAccount: user2UsdcTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          },
        })
      },
      (err) => {
        assert.equal(err.code, 302);
        assert.equal(err.msg, "Cannot transfer royalty share larger than current share");
        return true;
      }
    );
  });

  it('Fails to transfer revenue share if revenue share users exceeds 10', async () => {

    await assert.rejects(
      async () => {
        const users = [];
        while (users.length < 10) {
          users.push(anchor.web3.Keypair.generate());
        };

        for (let user of users) {
          user = await newAccount(provider, 1e10, user)
          const [userUsdc, userUsdcIx] = await findOrCreateAssociatedTokenAccount(
            provider,
            user.publicKey,
            anchor.web3.SystemProgram.programId,
            anchor.web3.SYSVAR_RENT_PUBKEY,
            usdcMint,
          );
          const amountToTransfer = 500;
          await nina.rpc.releaseRevenueShareTransfer(
            new anchor.BN(amountToTransfer), {
            accounts: {
              authority: provider.wallet.publicKey,
              authorityTokenAccount: usdcTokenAccount,
              release,
              releaseSigner,
              royaltyTokenAccount,
              newRoyaltyRecipient: user.publicKey,
              newRoyaltyRecipientTokenAccount: userUsdc,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            instructions: [userUsdcIx]
          })
        }      
      },
      (err) => {
        assert.equal(err.code, 303);
        assert.equal(err.msg, "Cannot have more than 10 Revenue Share Holders");
        return true;
      }
    );
  });

  it('Appends Revenue Share transfer to user with existing share', async () => {
    let releaseBefore = await nina.account.release.fetch(release);
    const royaltyRecipient0PercentShareBeforeTx = releaseBefore.royaltyRecipients[0].percentShare.toNumber();
    const royaltyRecipient1PercentShareBeforeTx = releaseBefore.royaltyRecipients[1].percentShare.toNumber();
    
    const amountToTransfer = 250000;
    await nina.rpc.releaseRevenueShareTransfer(
      new anchor.BN(amountToTransfer), {
      accounts: {
        authority: provider.wallet.publicKey,
        authorityTokenAccount: usdcTokenAccount,
        release,
        releaseSigner,
        royaltyTokenAccount,
        newRoyaltyRecipient: user2.publicKey,
        newRoyaltyRecipientTokenAccount: user2UsdcTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
    });

    let releaseAfter = await nina.account.release.fetch(release);
    assert.equal(
      releaseAfter.royaltyRecipients[0].percentShare.toNumber(),
      royaltyRecipient0PercentShareBeforeTx - amountToTransfer,
    );
    assert.equal(
      releaseAfter.royaltyRecipients[1].percentShare.toNumber(),
      royaltyRecipient1PercentShareBeforeTx + amountToTransfer,
    );
  });
});

describe("Exchange", async () => {
  let exchange;
  let exchangeSigner = null;
  let exchangeEscrowTokenAccount  = null;

  it("Initializes a buy exchange USDC", async () => {
    exchange = anchor.web3.Keypair.generate();

    const [_exchangeSigner, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [exchange.publicKey.toBuffer()],
      nina.programId
    );
    exchangeSigner = _exchangeSigner;

    let [_exchangeEscrowTokenAccount, exchangeEscrowTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      exchangeSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      usdcMint,
    );
    exchangeEscrowTokenAccount = _exchangeEscrowTokenAccount

    const config = {
      expectedAmount: new anchor.BN(1),
      initializerAmount: new anchor.BN(initializerAmount),
      isSelling: false,
    }

    await nina.rpc.exchangeInit(
      config,
      bump, {
        accounts: {
          initializer: provider.wallet.publicKey,
          releaseMint: releaseMint.publicKey,
          initializerExpectedTokenAccount: authorityReleaseTokenAccount,
          initializerSendingTokenAccount: usdcTokenAccount,
          initializerExpectedMint: releaseMint.publicKey,
          initializerSendingMint: usdcMint,
          exchangeEscrowTokenAccount,
          exchangeSigner,
          exchange: exchange.publicKey,
          release,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers:[exchange],
        instructions: [
          await nina.account.exchange.createInstruction(exchange),
          exchangeEscrowTokenAccountIx,
        ],
      }
    )

    const exchangeAfter = await nina.account.exchange.fetch(exchange.publicKey);
    const exchangeAccountEscrowTokenAccount = await getTokenAccount(
      provider,
      exchangeAfter.exchangeEscrowTokenAccount,
    );
    assert.ok(exchangeAccountEscrowTokenAccount.amount.toNumber() === config.initializerAmount.toNumber());
  });

  it('Fails to Cancel an existing exchange USDC if not the authority', async () => {
    await assert.rejects(
      async () => {
        await nina.rpc.exchangeCancel(
          new anchor.BN(initializerAmount), {
            accounts: {
              initializer: user1.publicKey,
              initializerSendingTokenAccount: user1UsdcTokenAccount,
              exchangeEscrowTokenAccount: exchangeEscrowTokenAccount,
              exchangeSigner,
              exchange: exchange.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [user1],
          }
        );
      },
      (err) => {
        assert.equal(err.code, 143);
        assert.equal(err.msg, "A raw constraint was violated");
        return true;
      }
    );
  });

  it('Cancels an existing exchange USDC', async () => {
    let usdcTokenAccountBefore = await getTokenAccount(
      provider,
      usdcTokenAccount,
    );
    const usdcTokenAccountBeforeBalanceTx = usdcTokenAccountBefore.amount.toNumber();

    await nina.rpc.exchangeCancel(
      new anchor.BN(initializerAmount), {
        accounts: {
          initializer: provider.wallet.publicKey,
          initializerSendingTokenAccount: usdcTokenAccount,
          exchangeEscrowTokenAccount: exchangeEscrowTokenAccount,
          exchangeSigner,
          exchange: exchange.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )
    const usdcTokenAccountAfter = await getTokenAccount(
      provider,
      usdcTokenAccount,
    );
    assert.ok(usdcTokenAccountAfter.amount.toNumber() === usdcTokenAccountBeforeBalanceTx + initializerAmount)

    await assert.rejects(
      async () => {
        await nina.account.exchange.fetch(exchange.publicKey);
      },
      (err) => {
        assert.ok(err.toString().includes("Account does not exist"));
        return true;
      }
    );
  });

  it("Initializes a second buy exchange USDC", async () => {
    exchange = anchor.web3.Keypair.generate();

    const [_exchangeSigner, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [exchange.publicKey.toBuffer()],
      nina.programId
    );
    exchangeSigner = _exchangeSigner;

    let [_exchangeEscrowTokenAccount, exchangeEscrowTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      exchangeSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      usdcMint,
    );
    exchangeEscrowTokenAccount = _exchangeEscrowTokenAccount

    const config = {
      expectedAmount: new anchor.BN(1),
      initializerAmount: new anchor.BN(initializerAmount),
      isSelling: false,
    }

    await nina.rpc.exchangeInit(
      config,
      bump, {
        accounts: {
          initializer: provider.wallet.publicKey,
          releaseMint: releaseMint.publicKey,
          initializerExpectedTokenAccount: authorityReleaseTokenAccount,
          initializerSendingTokenAccount: usdcTokenAccount,
          initializerExpectedMint: releaseMint.publicKey,
          initializerSendingMint: usdcMint,
          exchangeEscrowTokenAccount,
          exchangeSigner,
          exchange: exchange.publicKey,
          release,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers:[exchange],
        instructions: [
          await nina.account.exchange.createInstruction(exchange),
          exchangeEscrowTokenAccountIx,
        ],
      }
    )

    const exchangeAfter = await nina.account.exchange.fetch(exchange.publicKey);
    const exchangeAccountEscrowTokenAccount = await getTokenAccount(
      provider,
      exchangeAfter.exchangeEscrowTokenAccount,
    );
    assert.ok(exchangeAccountEscrowTokenAccount.amount.toNumber() === config.initializerAmount.toNumber());
  });

  it('Fails to Accept a existing buy exchange with wrong release', async () => {
    const releaseBefore = await nina.account.release.fetch(release);

    const params = {
      expectedAmount: new anchor.BN(1),
      initializerAmount: new anchor.BN(initializerAmount),
      resalePercentage: releaseBefore.resalePercentage,
      datetime: new anchor.BN(Date.now() / 1000),
    };

    const exchangeHistory = anchor.web3.Keypair.generate();
    const createExchangeHistoryIx = await nina.account.exchangeHistory.createInstruction(exchangeHistory)

    await assert.rejects(
      async () => {
        await nina.rpc.exchangeAccept(
          params, {
            accounts: {
              initializer: provider.wallet.publicKey,
              initializerExpectedTokenAccount: authorityReleaseTokenAccount,
              takerExpectedTokenAccount: usdcTokenAccount,
              takerSendingTokenAccount: wrongReleaseTokenAccount,
              exchangeEscrowTokenAccount,
              exchangeSigner,
              taker: provider.wallet.publicKey,
              exchange: exchange.publicKey,
              exchangeHistory: exchangeHistory.publicKey,
              vault,
              vaultTokenAccount: vaultUsdcTokenAccount,
              release,
              royaltyTokenAccount: royaltyTokenAccount3,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [exchangeHistory],
            instructions: [createExchangeHistoryIx],
          }
        );
       
      },
      (err) => {
        assert.equal(err.toString(), "A raw constraint was violated");
        return true;
      }
    );
  });

  it('Fails to Accept an existing buy exchange if resale percentage wrong', async () => {
    const releaseBefore = await nina.account.release.fetch(release);

    const badResalePercentage = new anchor.BN(20);
    const params = {
      expectedAmount: new anchor.BN(1),
      initializerAmount: new anchor.BN(initializerAmount),
      resalePercentage: badResalePercentage,
      datetime: new anchor.BN(Date.now() / 1000),
    };
    const exchangeHistory = anchor.web3.Keypair.generate();
    const createExchangeHistoryIx = await nina.account.exchangeHistory.createInstruction(exchangeHistory)

    await assert.rejects(
      async () => {
        await nina.rpc.exchangeAccept(
          params, {
            accounts: {
              initializer: provider.wallet.publicKey,
              initializerExpectedTokenAccount: authorityReleaseTokenAccount,
              takerExpectedTokenAccount: user1UsdcTokenAccount,
              takerSendingTokenAccount: purchaserReleaseTokenAccount,
              exchangeEscrowTokenAccount,
              exchangeSigner,
              taker: user1.publicKey,
              exchange: exchange.publicKey,
              exchangeHistory: exchangeHistory.publicKey,
              vault: vault,
              vaultTokenAccount: vaultUsdcTokenAccount,
              release,
              royaltyTokenAccount,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [user1, exchangeHistory],
            instructions: [createExchangeHistoryIx],
          }
        );
      },
      (err) => {
        assert.equal(err.code, 305)
        assert.equal(err.msg, "Royalty percentage provided is incorrect");
        return true;
      }
    );
  });

  it('Fails to Accept an existing buy exchange if initializerAmount wrong', async () => {
    const releaseBefore = await nina.account.release.fetch(release);

    const params = {
      expectedAmount: new anchor.BN(1),
      initializerAmount: new anchor.BN(111),
      resalePercentage: releaseBefore.resalePercentage,
      datetime: new anchor.BN(Date.now() / 1000),
    };
    const exchangeHistory = anchor.web3.Keypair.generate();
    const createExchangeHistoryIx = await nina.account.exchangeHistory.createInstruction(exchangeHistory)

    await assert.rejects(
      async () => {
        await nina.rpc.exchangeAccept(
          params, {
            accounts: {
              initializer: provider.wallet.publicKey,
              initializerExpectedTokenAccount: authorityReleaseTokenAccount,
              takerExpectedTokenAccount: user1UsdcTokenAccount,
              takerSendingTokenAccount: purchaserReleaseTokenAccount,
              exchangeEscrowTokenAccount,
              exchangeSigner,
              taker: user1.publicKey,
              exchange: exchange.publicKey,
              exchangeHistory: exchangeHistory.publicKey,
              vault: vault,
              vaultTokenAccount: vaultUsdcTokenAccount,
              release,
              royaltyTokenAccount,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [user1, exchangeHistory],
            instructions: [createExchangeHistoryIx],
          }
        );
      },
      (err) => {
        assert.equal(err.code, 317)
        assert.equal(err.msg, "Initializer Amounts Do Not Match");
        return true;
      }
    );
  });

  it('Fails to Accept an existing buy exchange if expectedAmount wrong', async () => {
    const releaseBefore = await nina.account.release.fetch(release);

    const params = {
      expectedAmount: new anchor.BN(5),
      initializerAmount: new anchor.BN(initializerAmount),
      resalePercentage: releaseBefore.resalePercentage,
      datetime: new anchor.BN(Date.now() / 1000),
    };
    const exchangeHistory = anchor.web3.Keypair.generate();
    const createExchangeHistoryIx = await nina.account.exchangeHistory.createInstruction(exchangeHistory)

    await assert.rejects(
      async () => {
        await nina.rpc.exchangeAccept(
          params, {
            accounts: {
              initializer: provider.wallet.publicKey,
              initializerExpectedTokenAccount: authorityReleaseTokenAccount,
              takerExpectedTokenAccount: user1UsdcTokenAccount,
              takerSendingTokenAccount: purchaserReleaseTokenAccount,
              exchangeEscrowTokenAccount,
              exchangeSigner,
              taker: user1.publicKey,
              exchange: exchange.publicKey,
              exchangeHistory: exchangeHistory.publicKey,
              vault: vault,
              vaultTokenAccount: vaultUsdcTokenAccount,
              release,
              royaltyTokenAccount,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [user1, exchangeHistory],
            instructions: [createExchangeHistoryIx],
          }
        );
      },
      (err) => {
        assert.equal(err.code, 314)
        assert.equal(err.msg, "Exchange Expected Amounts Do Not Match");
        return true;
      }
    );
  });


  it('Accepts an existing buy exchange USDC', async () => {
    const user1UsdcTokenAccountBefore = await getTokenAccount(
      provider,
      user1UsdcTokenAccount,
    );
    const user1UsdcTokenAccountBeforeBalance = user1UsdcTokenAccountBefore.amount.toNumber();

    const purchaserReleaseTokenAccountBefore = await getTokenAccount(
      provider,
      purchaserReleaseTokenAccount,
    );
    const purchaserReleaseTokenAccountBeforeBalance = purchaserReleaseTokenAccountBefore.amount.toNumber();

    const authorityReleaseTokenAccountBefore = await getTokenAccount(
      provider,
      authorityReleaseTokenAccount,
    );
    const authorityReleaseTokenAccountBeforeBalance = authorityReleaseTokenAccountBefore.amount.toNumber();

    const royaltyTokenAccountBefore = await getTokenAccount(
      provider,
      royaltyTokenAccount,
    );
    const royaltyTokenAccountBeforeBalance = royaltyTokenAccountBefore.amount.toNumber();

    const vaultUsdcTokenAccountBefore = await getTokenAccount(
      provider,
      vaultUsdcTokenAccount,
    );
    const vaultUsdcTokenAccountBeforeBalance = vaultUsdcTokenAccountBefore.amount.toNumber();

    const releaseBefore = await nina.account.release.fetch(release);

    const params = {
      expectedAmount: new anchor.BN(1),
      initializerAmount: new anchor.BN(initializerAmount),
      resalePercentage: releaseBefore.resalePercentage,
      datetime: new anchor.BN(Date.now() / 1000),
    };

    const exchangeHistory = anchor.web3.Keypair.generate();
    const createExchangeHistoryIx = await nina.account.exchangeHistory.createInstruction(exchangeHistory)

    await nina.rpc.exchangeAccept(
      params, {
        accounts: {
          initializer: provider.wallet.publicKey,
          initializerExpectedTokenAccount: authorityReleaseTokenAccount,
          takerExpectedTokenAccount: user1UsdcTokenAccount,
          takerSendingTokenAccount: purchaserReleaseTokenAccount,
          exchangeEscrowTokenAccount,
          exchangeSigner,
          taker: user1.publicKey,
          exchange: exchange.publicKey,
          exchangeHistory: exchangeHistory.publicKey,
          vault: vault,
          vaultTokenAccount: vaultUsdcTokenAccount,
          release,
          royaltyTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [user1, exchangeHistory],
        instructions: [createExchangeHistoryIx],
      }
    );

    const user1UsdcTokenAccountAfter = await getTokenAccount(
      provider,
      user1UsdcTokenAccount,
    );
    const user1UsdcTokenAccountAfterBalance = user1UsdcTokenAccountAfter.amount.toNumber();

    const purchaserReleaseTokenAccountAfter = await getTokenAccount(
      provider,
      purchaserReleaseTokenAccount,
    );
    const purchaserReleaseTokenAccountAfterBalance = purchaserReleaseTokenAccountAfter.amount.toNumber();

    const authorityReleaseTokenAccountAfter = await getTokenAccount(
      provider,
      authorityReleaseTokenAccount,
    );
    const authorityReleaseTokenAccountAfterBalance = authorityReleaseTokenAccountAfter.amount.toNumber();

    const royaltyTokenAccountAfter = await getTokenAccount(
      provider,
      royaltyTokenAccount,
    );
    const royaltyTokenAccountAfterBalance = royaltyTokenAccountAfter.amount.toNumber();

    const vaultUsdcTokenAccountAfter = await getTokenAccount(
      provider,
      vaultUsdcTokenAccount,
    );
    const vaultUsdcTokenAccountAfterBalance = vaultUsdcTokenAccountAfter.amount.toNumber();

    const expectedVaultFee = 62500
    const expectedRoyaltyFee = 1000000

    assert.ok(user1UsdcTokenAccountAfterBalance === user1UsdcTokenAccountBeforeBalance + initializerAmount - expectedVaultFee - expectedRoyaltyFee)
    assert.ok(authorityReleaseTokenAccountAfterBalance === authorityReleaseTokenAccountBeforeBalance + 1);
    assert.ok(royaltyTokenAccountAfterBalance === royaltyTokenAccountBeforeBalance + expectedRoyaltyFee);
    assert.ok(vaultUsdcTokenAccountAfterBalance === vaultUsdcTokenAccountBeforeBalance + expectedVaultFee);

    const releaseAfter = await nina.account.release.fetch(release);
    assert.ok(releaseAfter.exchangeSaleCounter.toNumber() === releaseBefore.exchangeSaleCounter.toNumber() + 1);
    assert.ok(releaseAfter.exchangeSaleTotal.toNumber() === releaseBefore.exchangeSaleTotal.toNumber() + expectedRoyaltyFee);
    assert.ok(releaseAfter.totalCollected.toNumber() === releaseBefore.totalCollected.toNumber() + expectedRoyaltyFee);
    assert.ok(releaseAfter.royaltyRecipients[0].owed.toNumber() === (expectedRoyaltyFee * releaseAfter.royaltyRecipients[0].percentShare.toNumber()) / 1000000);
    assert.ok(releaseAfter.royaltyRecipients[1].owed.toNumber() === (expectedRoyaltyFee * releaseAfter.royaltyRecipients[1].percentShare.toNumber()) / 1000000);
 
    const exchangeHistoryAfter = await nina.account.exchangeHistory.fetch(exchangeHistory.publicKey);
    assert.ok(exchangeHistoryAfter.release.toBase58() === release.toBase58());
    assert.ok(exchangeHistoryAfter.seller.toBase58() === user1.publicKey.toBase58());
    assert.ok(exchangeHistoryAfter.buyer.toBase58() === provider.wallet.publicKey.toBase58());
    assert.ok(exchangeHistoryAfter.price.toNumber() === params.initializerAmount.toNumber());
   
    await assert.rejects(
      async () => {
        await nina.account.exchange.fetch(exchange.publicKey);
      },
      (err) => {
        assert.ok(err.toString().includes("Account does not exist"));
        return true;
      }
    );
  });

  it("Initializes a sell exchange USDC", async () => {
    exchange = anchor.web3.Keypair.generate();
    
    const authorityReleaseTokenAccountBefore = await getTokenAccount(
      provider,
      authorityReleaseTokenAccount,
    );
    const authorityReleaseTokenAccountBeforeBalance = authorityReleaseTokenAccountBefore.amount.toNumber();

    const [_exchangeSigner, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [exchange.publicKey.toBuffer()],
      nina.programId
    );
    exchangeSigner = _exchangeSigner;

    let [_exchangeEscrowTokenAccount, exchangeEscrowTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      exchangeSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMint.publicKey,
    );
    exchangeEscrowTokenAccount = _exchangeEscrowTokenAccount

    const config = {
      expectedAmount: new anchor.BN(expectedAmountExchangeSellOffer),
      initializerAmount: new anchor.BN(1),
      isSelling: true,
    }

    await nina.rpc.exchangeInit(
      config,
      bump, {
        accounts: {
          initializer: provider.wallet.publicKey,
          releaseMint: releaseMint.publicKey,
          initializerExpectedTokenAccount: usdcTokenAccount,
          initializerSendingTokenAccount: authorityReleaseTokenAccount,
          initializerExpectedMint: usdcMint,
          initializerSendingMint: releaseMint.publicKey,
          exchangeEscrowTokenAccount,
          exchangeSigner,
          exchange: exchange.publicKey,
          release,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers:[exchange],
        instructions: [
          await nina.account.exchange.createInstruction(exchange),
          exchangeEscrowTokenAccountIx,
        ],
      }
    )

    const authorityReleaseTokenAccountAfter = await getTokenAccount(
      provider,
      authorityReleaseTokenAccount,
    );
    const authorityReleaseTokenAccountAfterBalance = authorityReleaseTokenAccountAfter.amount.toNumber();
    assert.ok(authorityReleaseTokenAccountAfterBalance === authorityReleaseTokenAccountBeforeBalance - 1);

    const exchangeAfter = await nina.account.exchange.fetch(exchange.publicKey);
    assert.ok(exchangeAfter.expectedAmount.toNumber() === expectedAmountExchangeSellOffer);
    const exchangeAccountEscrowTokenAccount = await getTokenAccount(
      provider,
      exchangeAfter.exchangeEscrowTokenAccount,
    );
    assert.ok(exchangeAccountEscrowTokenAccount.amount.toNumber() === 1);
  });

  it('Accepts an existing sell exchange USDC', async () => {
    const usdcTokenAccountBefore = await getTokenAccount(
      provider,
      usdcTokenAccount,
    );
    const usdcTokenAccountBeforeBalance = usdcTokenAccountBefore.amount.toNumber();

    const user1UsdcTokenAccountBefore = await getTokenAccount(
      provider,
      user1UsdcTokenAccount,
    );
    const user1UsdcTokenAccountBeforeBalance = user1UsdcTokenAccountBefore.amount.toNumber();

    const purchaserReleaseTokenAccountBefore = await getTokenAccount(
      provider,
      purchaserReleaseTokenAccount,
    );
    const purchaserReleaseTokenAccountBeforeBalance = purchaserReleaseTokenAccountBefore.amount.toNumber();

    const royaltyTokenAccountBefore = await getTokenAccount(
      provider,
      royaltyTokenAccount,
    );
    const royaltyTokenAccountBeforeBalance = royaltyTokenAccountBefore.amount.toNumber();

    const vaultUsdcTokenAccountBefore = await getTokenAccount(
      provider,
      vaultUsdcTokenAccount,
    );
    const vaultUsdcTokenAccountBeforeBalance = vaultUsdcTokenAccountBefore.amount.toNumber();

    const releaseBefore = await nina.account.release.fetch(release);

    const params = {
      expectedAmount: new anchor.BN(initializerAmount),
      initializerAmount: new anchor.BN(1),
      resalePercentage: releaseBefore.resalePercentage,
      datetime: new anchor.BN(Date.now() / 1000),
    };

    const exchangeHistory = anchor.web3.Keypair.generate();
    const createExchangeHistoryIx = await nina.account.exchangeHistory.createInstruction(exchangeHistory)

    await nina.rpc.exchangeAccept(
      params, {
        accounts: {
          initializer: provider.wallet.publicKey,
          initializerExpectedTokenAccount: usdcTokenAccount,
          takerExpectedTokenAccount: purchaserReleaseTokenAccount,
          takerSendingTokenAccount: user1UsdcTokenAccount,
          exchangeEscrowTokenAccount,
          exchangeSigner,
          taker: user1.publicKey,
          exchange: exchange.publicKey,
          exchangeHistory: exchangeHistory.publicKey,
          vault,
          vaultTokenAccount: vaultUsdcTokenAccount,
          release,
          royaltyTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [user1, exchangeHistory],
        instructions: [createExchangeHistoryIx],
      }
    );

    const usdcTokenAccountAfter = await getTokenAccount(
      provider,
      usdcTokenAccount,
    );
    const usdcTokenAccountAfterBalance = usdcTokenAccountAfter.amount.toNumber();

    const user1UsdcTokenAccountAfter = await getTokenAccount(
      provider,
      user1UsdcTokenAccount,
    );
    const user1UsdcTokenAccountAfterBalance = user1UsdcTokenAccountAfter.amount.toNumber();

    const purchaserReleaseTokenAccountAfter = await getTokenAccount(
      provider,
      purchaserReleaseTokenAccount,
    );
    const purchaserReleaseTokenAccountAfterBalance = purchaserReleaseTokenAccountAfter.amount.toNumber();

    const royaltyTokenAccountAfter = await getTokenAccount(
      provider,
      royaltyTokenAccount,
    );
    const royaltyTokenAccountAfterBalance = royaltyTokenAccountAfter.amount.toNumber();

    const vaultUsdcTokenAccountAfter = await getTokenAccount(
      provider,
      vaultUsdcTokenAccount,
    );
    const vaultUsdcTokenAccountAfterBalance = vaultUsdcTokenAccountAfter.amount.toNumber();

    const expectedVaultFee = 62500
    const expectedRoyaltyFee = 1000000

    assert.ok(usdcTokenAccountAfterBalance === usdcTokenAccountBeforeBalance + initializerAmount - expectedVaultFee - expectedRoyaltyFee)
    assert.ok(user1UsdcTokenAccountAfterBalance === user1UsdcTokenAccountBeforeBalance - initializerAmount);
    assert.ok(purchaserReleaseTokenAccountAfterBalance === purchaserReleaseTokenAccountBeforeBalance + 1);
    assert.ok(royaltyTokenAccountAfterBalance === royaltyTokenAccountBeforeBalance + expectedRoyaltyFee);
    assert.ok(vaultUsdcTokenAccountAfterBalance === vaultUsdcTokenAccountBeforeBalance + expectedVaultFee);

    const releaseAfter = await nina.account.release.fetch(release);
    assert.ok(releaseAfter.exchangeSaleCounter.toNumber() === releaseBefore.exchangeSaleCounter.toNumber() + 1);
    assert.ok(releaseAfter.exchangeSaleTotal.toNumber() === releaseBefore.exchangeSaleTotal.toNumber() + expectedRoyaltyFee);
    assert.ok(releaseAfter.totalCollected.toNumber() === releaseBefore.totalCollected.toNumber() + expectedRoyaltyFee);
    assert.ok(releaseAfter.royaltyRecipients[0].owed.toNumber() === releaseBefore.royaltyRecipients[0].owed.toNumber() + (expectedRoyaltyFee * releaseAfter.royaltyRecipients[0].percentShare.toNumber()) / 1000000);
    assert.ok(releaseAfter.royaltyRecipients[1].owed.toNumber() === releaseBefore.royaltyRecipients[1].owed.toNumber() + (expectedRoyaltyFee * releaseAfter.royaltyRecipients[1].percentShare.toNumber()) / 1000000);
 
    const exchangeHistoryAfter = await nina.account.exchangeHistory.fetch(exchangeHistory.publicKey);
    assert.ok(exchangeHistoryAfter.release.toBase58() === release.toBase58());
    assert.ok(exchangeHistoryAfter.seller.toBase58() === provider.wallet.publicKey.toBase58());
    assert.ok(exchangeHistoryAfter.buyer.toBase58() === user1.publicKey.toBase58());
    assert.ok(exchangeHistoryAfter.price.toNumber() === params.expectedAmount.toNumber());
   
    await assert.rejects(
      async () => {
        await nina.account.exchange.fetch(exchange.publicKey);
      },
      (err) => {
        assert.ok(err.toString().includes("Account does not exist"));
        return true;
      }
    );
  });

  it("Initializes a buy exchange wSOL", async () => {
    const solBeforeBalance = await provider.connection.getBalance(provider.wallet.publicKey);

    exchange = anchor.web3.Keypair.generate();

    const [_exchangeSigner, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [exchange.publicKey.toBuffer()],
      nina.programId
    );
    exchangeSigner = _exchangeSigner;

    let [_exchangeEscrowTokenAccount, exchangeEscrowTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      exchangeSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      wrappedSolMint,
    );
    exchangeEscrowTokenAccount = _exchangeEscrowTokenAccount;

    const config = {
      expectedAmount: new anchor.BN(1),
      initializerAmount: new anchor.BN(initializerAmount),
      isSelling: false,
    };

    const {instructions, signers} = await wrapSol(
      provider,
      provider.wallet,
      new anchor.BN(initializerAmount),
    );

    const tx = await nina.rpc.exchangeInit(
      config,
      bump, {
        accounts: {
          initializer: provider.wallet.publicKey,
          releaseMint: releaseMint2.publicKey,
          initializerExpectedTokenAccount: authorityReleaseTokenAccount2,
          initializerSendingTokenAccount: signers[0].publicKey,
          initializerExpectedMint: releaseMint2.publicKey,
          initializerSendingMint: wrappedSolMint,
          exchangeEscrowTokenAccount,
          exchangeSigner,
          exchange: exchange.publicKey,
          release: release2,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers:[exchange, ...signers],
        instructions: [
          await nina.account.exchange.createInstruction(exchange),
          exchangeEscrowTokenAccountIx,
          ...instructions,
        ],
      }
    )

    const exchangeAfter = await nina.account.exchange.fetch(exchange.publicKey);
    const exchangeAccountEscrowTokenAccount = await getTokenAccount(
      provider,
      exchangeAfter.exchangeEscrowTokenAccount,
    );
    assert.ok(exchangeAccountEscrowTokenAccount.amount.toNumber() === config.initializerAmount.toNumber());
  });

  it('Cancels an existing exchange wSOL', async () => {
    const solBeforeBalance = await provider.connection.getBalance(provider.wallet.publicKey);
    
    const exchangeBefore = await nina.account.exchange.fetch(exchange.publicKey);
    const exchangeAccountEscrowTokenAccountBefore = await getTokenAccount(
      provider,
      exchangeBefore.exchangeEscrowTokenAccount,
    );

    await nina.rpc.exchangeCancelSol(
      new anchor.BN(initializerAmount), {
        accounts: {
          initializer: provider.wallet.publicKey,
          exchangeEscrowTokenAccount: exchangeEscrowTokenAccount,
          exchangeSigner,
          exchange: exchange.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    const solAfterBalance = await provider.connection.getBalance(provider.wallet.publicKey);
    assert.ok(solAfterBalance > solBeforeBalance + initializerAmount)

    await assert.rejects(
      async () => {
        await nina.account.exchange.fetch(exchange.publicKey);
      },
      (err) => {
        assert.ok(err.toString().includes("Account does not exist"));
        return true;
      }
    );
  });

  it("Initializes a second buy exchange wSOL", async () => {
    const solBeforeBalance = await provider.connection.getBalance(provider.wallet.publicKey);

    exchange = anchor.web3.Keypair.generate();

    const [_exchangeSigner, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [exchange.publicKey.toBuffer()],
      nina.programId
    );
    exchangeSigner = _exchangeSigner;

    let [_exchangeEscrowTokenAccount, exchangeEscrowTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      exchangeSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      wrappedSolMint,
    );
    exchangeEscrowTokenAccount = _exchangeEscrowTokenAccount;

    const config = {
      expectedAmount: new anchor.BN(1),
      initializerAmount: new anchor.BN(initializerAmount),
      isSelling: false,
    };

    const {instructions, signers} = await wrapSol(
      provider,
      provider.wallet,
      new anchor.BN(initializerAmount),
    );

    const tx = await nina.rpc.exchangeInit(
      config,
      bump, {
        accounts: {
          initializer: provider.wallet.publicKey,
          releaseMint: releaseMint2.publicKey,
          initializerExpectedTokenAccount: authorityReleaseTokenAccount2,
          initializerSendingTokenAccount: signers[0].publicKey,
          initializerExpectedMint: releaseMint2.publicKey,
          initializerSendingMint: wrappedSolMint,
          exchangeEscrowTokenAccount,
          exchangeSigner,
          exchange: exchange.publicKey,
          release: release2,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers:[exchange, ...signers],
        instructions: [
          await nina.account.exchange.createInstruction(exchange),
          exchangeEscrowTokenAccountIx,
          ...instructions,
        ],
      }
    )

    const exchangeAfter = await nina.account.exchange.fetch(exchange.publicKey);
    const exchangeAccountEscrowTokenAccount = await getTokenAccount(
      provider,
      exchangeAfter.exchangeEscrowTokenAccount,
    );
    assert.ok(exchangeAccountEscrowTokenAccount.amount.toNumber() === config.initializerAmount.toNumber());
  });

  it('Accepts an existing buy exchange wSOL', async () => {
    const solBeforeBalance = await provider.connection.getBalance(user1.publicKey);

    const purchaserReleaseTokenAccount2Before = await getTokenAccount(
      provider,
      purchaserReleaseTokenAccount2,
    );
    const purchaserReleaseTokenAccount2BeforeBalance = purchaserReleaseTokenAccount2Before.amount.toNumber();

    const authorityReleaseTokenAccount2Before = await getTokenAccount(
      provider,
      authorityReleaseTokenAccount2,
    );
    const authorityReleaseTokenAccount2BeforeBalance = authorityReleaseTokenAccount2Before.amount.toNumber();

    const royaltyTokenAccount2Before = await getTokenAccount(
      provider,
      royaltyTokenAccount2,
    );
    const royaltyTokenAccount2BeforeBalance = royaltyTokenAccount2Before.amount.toNumber();

    const vaultWrappedSolTokenAccountBefore = await getTokenAccount(
      provider,
      vaultWrappedSolTokenAccount,
    );
    const vaultWrappedSolTokenAccountBeforeBalance = vaultWrappedSolTokenAccountBefore.amount.toNumber();

    const releaseBefore = await nina.account.release.fetch(release2);

    const params = {
      expectedAmount: new anchor.BN(1),
      initializerAmount: new anchor.BN(initializerAmount),
      resalePercentage: releaseBefore.resalePercentage,
      datetime: new anchor.BN(Date.now() / 1000),
    };

    const exchangeHistory = anchor.web3.Keypair.generate();
    const createExchangeHistoryIx = await nina.account.exchangeHistory.createInstruction(exchangeHistory);

    await nina.rpc.exchangeAccept(
      params, {
        accounts: {
          initializer: provider.wallet.publicKey,
          initializerExpectedTokenAccount: authorityReleaseTokenAccount2,
          takerExpectedTokenAccount: user1WrappedSolTokenAccount,
          takerSendingTokenAccount: purchaserReleaseTokenAccount2,
          exchangeEscrowTokenAccount,
          exchangeSigner,
          taker: user1.publicKey,
          exchange: exchange.publicKey,
          exchangeHistory: exchangeHistory.publicKey,
          vault,
          vaultTokenAccount: vaultWrappedSolTokenAccount,
          release: release2,
          royaltyTokenAccount: royaltyTokenAccount2,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [user1, exchangeHistory],
        instructions: [createExchangeHistoryIx],
      }
    );

    const solAfterBalance = await provider.connection.getBalance(user1.publicKey);

    const purchaserReleaseTokenAccount2After = await getTokenAccount(
      provider,
      purchaserReleaseTokenAccount2,
    );
    const purchaserReleaseTokenAccount2AfterBalance = purchaserReleaseTokenAccount2After.amount.toNumber();

    const authorityReleaseTokenAccount2After = await getTokenAccount(
      provider,
      authorityReleaseTokenAccount2,
    );
    const authorityReleaseTokenAccount2AfterBalance = authorityReleaseTokenAccount2After.amount.toNumber();

    const royaltyTokenAccount2After = await getTokenAccount(
      provider,
      royaltyTokenAccount2,
    );
    const royaltyTokenAccount2AfterBalance = royaltyTokenAccount2After.amount.toNumber();

    const vaultWrappedSolTokenAccountAfter = await getTokenAccount(
      provider,
      vaultWrappedSolTokenAccount,
    );
    const vaultWrappedSolTokenAccountAfterBalance = vaultWrappedSolTokenAccountAfter.amount.toNumber();

    const expectedVaultFee = 62500
    const expectedRoyaltyFee = 1000000

    assert.ok(solAfterBalance === solBeforeBalance + initializerAmount - expectedVaultFee - expectedRoyaltyFee);
    assert.ok(authorityReleaseTokenAccount2AfterBalance === authorityReleaseTokenAccount2BeforeBalance + 1);
    assert.ok(royaltyTokenAccount2AfterBalance === royaltyTokenAccount2BeforeBalance + expectedRoyaltyFee);
    assert.ok(vaultWrappedSolTokenAccountAfterBalance === vaultWrappedSolTokenAccountBeforeBalance + expectedVaultFee);

    const releaseAfter = await nina.account.release.fetch(release2);
    assert.ok(releaseAfter.exchangeSaleCounter.toNumber() === releaseBefore.exchangeSaleCounter.toNumber() + 1);
    assert.ok(releaseAfter.exchangeSaleTotal.toNumber() === releaseBefore.exchangeSaleTotal.toNumber() + expectedRoyaltyFee);
    assert.ok(releaseAfter.totalCollected.toNumber() === releaseBefore.totalCollected.toNumber() + expectedRoyaltyFee);
    assert.ok(releaseAfter.royaltyRecipients[0].owed.toNumber() === releaseBefore.royaltyRecipients[0].owed.toNumber() + (expectedRoyaltyFee * releaseAfter.royaltyRecipients[0].percentShare.toNumber()) / 1000000);
     assert.ok(releaseAfter.royaltyRecipients[1].owed.toNumber() === releaseBefore.royaltyRecipients[1].owed.toNumber() + (expectedRoyaltyFee * releaseAfter.royaltyRecipients[1].percentShare.toNumber()) / 1000000);

    const exchangeHistoryAfter = await nina.account.exchangeHistory.fetch(exchangeHistory.publicKey);
    assert.ok(exchangeHistoryAfter.release.toBase58() === release2.toBase58());
    assert.ok(exchangeHistoryAfter.seller.toBase58() === user1.publicKey.toBase58());
    assert.ok(exchangeHistoryAfter.buyer.toBase58() === provider.wallet.publicKey.toBase58());
    assert.ok(exchangeHistoryAfter.price.toNumber() === params.initializerAmount.toNumber());
   
    await assert.rejects(
      async () => {
        await nina.account.exchange.fetch(exchange.publicKey);
      },
      (err) => {
        assert.ok(err.toString().includes("Account does not exist"));
        return true;
      }
    );
  });

  it("Initializes a sell exchange wSOL", async () => {
    exchange = anchor.web3.Keypair.generate();
    
    const authorityReleaseTokenAccount2Before = await getTokenAccount(
      provider,
      authorityReleaseTokenAccount2,
    );
    const authorityReleaseTokenAccount2BeforeBalance = authorityReleaseTokenAccount2Before.amount.toNumber();

    const [_exchangeSigner, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [exchange.publicKey.toBuffer()],
      nina.programId
    );
    exchangeSigner = _exchangeSigner;

    let [_exchangeEscrowTokenAccount, exchangeEscrowTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      exchangeSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      releaseMint2.publicKey,
    );
    exchangeEscrowTokenAccount = _exchangeEscrowTokenAccount

    const config = {
      expectedAmount: new anchor.BN(expectedAmountExchangeSellOffer),
      initializerAmount: new anchor.BN(1),
      isSelling: true,
    }

    await nina.rpc.exchangeInit(
      config,
      bump, {
        accounts: {
          initializer: provider.wallet.publicKey,
          releaseMint: releaseMint2.publicKey,
          initializerExpectedTokenAccount: wrappedSolTokenAccount,
          initializerSendingTokenAccount: authorityReleaseTokenAccount2,
          initializerExpectedMint: wrappedSolMint,
          initializerSendingMint: releaseMint2.publicKey,
          exchangeEscrowTokenAccount,
          exchangeSigner,
          exchange: exchange.publicKey,
          release: release2,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers:[exchange],
        instructions: [
          await nina.account.exchange.createInstruction(exchange),
          exchangeEscrowTokenAccountIx,
        ],
      }
    )

    const authorityReleaseTokenAccount2After = await getTokenAccount(
      provider,
      authorityReleaseTokenAccount2,
    );
    const authorityReleaseTokenAccount2AfterBalance = authorityReleaseTokenAccount2After.amount.toNumber();
    assert.ok(authorityReleaseTokenAccount2AfterBalance === authorityReleaseTokenAccount2BeforeBalance - 1);

    const exchangeAfter = await nina.account.exchange.fetch(exchange.publicKey);
    assert.ok(exchangeAfter.expectedAmount.toNumber() === expectedAmountExchangeSellOffer);
    const exchangeAccountEscrowTokenAccount = await getTokenAccount(
      provider,
      exchangeAfter.exchangeEscrowTokenAccount,
    );
    assert.ok(exchangeAccountEscrowTokenAccount.amount.toNumber() === 1);
  });

  it('Accepts an existing sell exchange wSOL', async () => {
    const solBeforeBalance = await provider.connection.getBalance(provider.wallet.publicKey);

    const user1SolBeforeBalance = await provider.connection.getBalance(user1.publicKey);

    const purchaserReleaseTokenAccountBefore = await getTokenAccount(
      provider,
      purchaserReleaseTokenAccount2,
    );
    const purchaserReleaseTokenAccountBeforeBalance = purchaserReleaseTokenAccountBefore.amount.toNumber();

    const royaltyTokenAccountBefore = await getTokenAccount(
      provider,
      royaltyTokenAccount2,
    );
    const royaltyTokenAccountBeforeBalance = royaltyTokenAccountBefore.amount.toNumber();

    const vaultWrappedSolTokenAccountBefore = await getTokenAccount(
      provider,
      vaultWrappedSolTokenAccount,
    );
    const vaultWrappedSolTokenAccountBeforeBalance = vaultWrappedSolTokenAccountBefore.amount.toNumber();

    const releaseBefore = await nina.account.release.fetch(release2);

    const params = {
      expectedAmount: new anchor.BN(initializerAmount),
      initializerAmount: new anchor.BN(1),
      resalePercentage: releaseBefore.resalePercentage,
      datetime: new anchor.BN(Date.now() / 1000),
    };

    const exchangeHistory = anchor.web3.Keypair.generate();
    const createExchangeHistoryIx = await nina.account.exchangeHistory.createInstruction(exchangeHistory)

    const {instructions, signers} = await wrapSol(
      provider,
      user1,
      new anchor.BN(initializerAmount),
    );

    await nina.rpc.exchangeAccept(
      params, {
        accounts: {
          initializer: provider.wallet.publicKey,
          initializerExpectedTokenAccount: wrappedSolTokenAccount,
          takerExpectedTokenAccount: purchaserReleaseTokenAccount2,
          takerSendingTokenAccount: signers[0].publicKey,
          exchangeEscrowTokenAccount,
          exchangeSigner,
          taker: user1.publicKey,
          exchange: exchange.publicKey,
          exchangeHistory: exchangeHistory.publicKey,
          vault,
          vaultTokenAccount: vaultWrappedSolTokenAccount,
          release: release2,
          royaltyTokenAccount: royaltyTokenAccount2,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [user1, exchangeHistory, ...signers],
        instructions: [
          ...instructions,
          createExchangeHistoryIx,
        ],
      }
    );

    const solAfterBalance = await provider.connection.getBalance(provider.wallet.publicKey);

    const user1SolAfterBalance = await provider.connection.getBalance(user1.publicKey);

    const purchaserReleaseTokenAccountAfter = await getTokenAccount(
      provider,
      purchaserReleaseTokenAccount2,
    );
    const purchaserReleaseTokenAccountAfterBalance = purchaserReleaseTokenAccountAfter.amount.toNumber();

    const royaltyTokenAccountAfter = await getTokenAccount(
      provider,
      royaltyTokenAccount2,
    );
    const royaltyTokenAccountAfterBalance = royaltyTokenAccountAfter.amount.toNumber();

    const vaultWrappedSolTokenAccountAfter = await getTokenAccount(
      provider,
      vaultWrappedSolTokenAccount,
    );
    const vaultWrappedSolTokenAccountAfterBalance = vaultWrappedSolTokenAccountAfter.amount.toNumber();

    const expectedVaultFee = 62500
    const expectedRoyaltyFee = 1000000

    assert.ok(solAfterBalance > solBeforeBalance + initializerAmount - expectedVaultFee - expectedRoyaltyFee)
    assert.ok(user1SolAfterBalance === user1SolBeforeBalance - initializerAmount);
    assert.ok(purchaserReleaseTokenAccountAfterBalance === purchaserReleaseTokenAccountBeforeBalance + 1);
    assert.ok(royaltyTokenAccountAfterBalance === royaltyTokenAccountBeforeBalance + expectedRoyaltyFee);
    assert.ok(vaultWrappedSolTokenAccountAfterBalance === vaultWrappedSolTokenAccountBeforeBalance + expectedVaultFee);

    const releaseAfter = await nina.account.release.fetch(release2);
    assert.ok(releaseAfter.exchangeSaleCounter.toNumber() === releaseBefore.exchangeSaleCounter.toNumber() + 1);
    assert.ok(releaseAfter.exchangeSaleTotal.toNumber() === releaseBefore.exchangeSaleTotal.toNumber() + expectedRoyaltyFee);
    assert.ok(releaseAfter.totalCollected.toNumber() === releaseBefore.totalCollected.toNumber() + expectedRoyaltyFee);
    assert.ok(releaseAfter.royaltyRecipients[0].owed.toNumber() === releaseBefore.royaltyRecipients[0].owed.toNumber() + (expectedRoyaltyFee * releaseAfter.royaltyRecipients[0].percentShare.toNumber()) / 1000000);
    assert.ok(releaseAfter.royaltyRecipients[1].owed.toNumber() === releaseBefore.royaltyRecipients[1].owed.toNumber() + (expectedRoyaltyFee * releaseAfter.royaltyRecipients[1].percentShare.toNumber()) / 1000000);
 
    const exchangeHistoryAfter = await nina.account.exchangeHistory.fetch(exchangeHistory.publicKey);
    assert.ok(exchangeHistoryAfter.release.toBase58() === release2.toBase58());
    assert.ok(exchangeHistoryAfter.seller.toBase58() === provider.wallet.publicKey.toBase58());
    assert.ok(exchangeHistoryAfter.buyer.toBase58() === user1.publicKey.toBase58());
    assert.ok(exchangeHistoryAfter.price.toNumber() === params.expectedAmount.toNumber());
   
    await assert.rejects(
      async () => {
        await nina.account.exchange.fetch(exchange.publicKey);
      },
      (err) => {
        assert.ok(err.toString().includes("Account does not exist"));
        return true;
      }
    );
  });

  it("Fails to Initialize exchange if wrong mint", async () => {
    exchange = anchor.web3.Keypair.generate();

    const [_exchangeSigner, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [exchange.publicKey.toBuffer()],
      nina.programId
    );
    exchangeSigner = _exchangeSigner;

    let [_exchangeEscrowTokenAccount, exchangeEscrowTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      exchangeSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      wrappedSolMint,
    );
    exchangeEscrowTokenAccount = _exchangeEscrowTokenAccount

    const config = {
      expectedAmount: new anchor.BN(1),
      initializerAmount: new anchor.BN(initializerAmount),
      isSelling: false,
    }

    await assert.rejects(
      async () => {
        await nina.rpc.exchangeInit(
          config,
          bump, {
            accounts: {
              initializer: provider.wallet.publicKey,
              releaseMint: releaseMint.publicKey,
              initializerExpectedTokenAccount: authorityReleaseTokenAccount,
              initializerSendingTokenAccount: wrappedSolTokenAccount,
              initializerExpectedMint: releaseMint.publicKey,
              initializerSendingMint: wrappedSolMint,
              exchangeEscrowTokenAccount,
              exchangeSigner,
              exchange: exchange.publicKey,
              release,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers:[exchange],
            instructions: [
              await nina.account.exchange.createInstruction(exchange),
              exchangeEscrowTokenAccountIx,
            ],
          }
        )
      },
      (err) => {
        assert.equal(err.code, 312);
        assert.equal(err.msg, "Wrong mint provided for exchange");
        return true;
      }
    );
  });

  it("Fails to Initialize exchange if expected amount too low", async () => {
    exchange = anchor.web3.Keypair.generate();

    const [_exchangeSigner, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [exchange.publicKey.toBuffer()],
      nina.programId
    );
    exchangeSigner = _exchangeSigner;

    let [_exchangeEscrowTokenAccount, exchangeEscrowTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      exchangeSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      wrappedSolMint,
    );
    exchangeEscrowTokenAccount = _exchangeEscrowTokenAccount

    const config = {
      expectedAmount: new anchor.BN(0),
      initializerAmount: new anchor.BN(initializerAmount),
      isSelling: false,
    }

    await assert.rejects(
      async () => {
        await nina.rpc.exchangeInit(
          config,
          bump, {
            accounts: {
              initializer: provider.wallet.publicKey,
              releaseMint: releaseMint.publicKey,
              initializerExpectedTokenAccount: authorityReleaseTokenAccount,
              initializerSendingTokenAccount: wrappedSolTokenAccount,
              initializerExpectedMint: releaseMint.publicKey,
              initializerSendingMint: wrappedSolMint,
              exchangeEscrowTokenAccount,
              exchangeSigner,
              exchange: exchange.publicKey,
              release,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers:[exchange],
            instructions: [
              await nina.account.exchange.createInstruction(exchange),
              exchangeEscrowTokenAccountIx,
            ],
          }
        )
      },
      (err) => {
        assert.equal(err.code, 313);
        assert.equal(err.msg, "Offer price must be greater than 0");
        return true;
      }
    );
  });

  it("Fails to Initialize exchange if initializerAmount too low", async () => {
    exchange = anchor.web3.Keypair.generate();

    const [_exchangeSigner, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [exchange.publicKey.toBuffer()],
      nina.programId
    );
    exchangeSigner = _exchangeSigner;

    let [_exchangeEscrowTokenAccount, exchangeEscrowTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      exchangeSigner,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      wrappedSolMint,
    );
    exchangeEscrowTokenAccount = _exchangeEscrowTokenAccount

    const config = {
      expectedAmount: new anchor.BN(1),
      initializerAmount: new anchor.BN(0),
      isSelling: false,
    }

    await assert.rejects(
      async () => {
        await nina.rpc.exchangeInit(
          config,
          bump, {
            accounts: {
              initializer: provider.wallet.publicKey,
              releaseMint: releaseMint.publicKey,
              initializerExpectedTokenAccount: authorityReleaseTokenAccount,
              initializerSendingTokenAccount: wrappedSolTokenAccount,
              initializerExpectedMint: releaseMint.publicKey,
              initializerSendingMint: wrappedSolMint,
              exchangeEscrowTokenAccount,
              exchangeSigner,
              exchange: exchange.publicKey,
              release,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers:[exchange],
            instructions: [
              await nina.account.exchange.createInstruction(exchange),
              exchangeEscrowTokenAccountIx,
            ],
          }
        )
      },
      (err) => {
        assert.equal(err.code, 313);
        assert.equal(err.msg, "Offer price must be greater than 0");
        return true;
      }
    );
  });
});

describe('Redeemable', async () => {
  let redeemable = null;
  let redeemableSigner = null;
  let redeemableNonce = null;
  let redeemedMint = null;
  let publisherEncryptionPublicKey = null
  let publisherKeys = null;

  it('Initializes a redeemable', async () => {
    [publisherEncryptionPublicKey, publisherKeys] = await encrypt.exportPublicKey();
    const encryptionPublicKeyBuffer = new Buffer.from(publisherEncryptionPublicKey)
    const description = "1x LP album"
    redeemedMint = anchor.web3.Keypair.generate();

    const [_redeemable, redeemableBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("nina-redeemable")), release.toBuffer(), redeemedMint.publicKey.toBuffer()],
      nina.programId
    );    
    redeemable = _redeemable
    const [_redeemableSigner, redeemableSignerBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("nina-redeemable-signer")), redeemable.toBuffer()],
      nina.programId
    );    
    redeemableSigner = _redeemableSigner;

    const redeemedMintIx = await createMintInstructions(
      provider,
      provider.wallet.publicKey,
      redeemedMint.publicKey,
      0,
    );

    const bumps = {
      redeemable: redeemableBump,
      signer: redeemableSignerBump,
    };

    const config = {
      encryptionPublicKey: encryptionPublicKeyBuffer,
      description,
      redeemedMax: new anchor.BN(3),
    };

    await nina.rpc.redeemableInit(
      config,
      bumps, {
        accounts: {
          authority: provider.wallet.publicKey,
          release,
          redeemable,
          redeemableSigner,
          redeemableMint: releaseMint.publicKey,
          redeemedMint: redeemedMint.publicKey,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [redeemedMint],
        instructions: [
          ...redeemedMintIx,
        ]
      }
    )

    const redeemableAfter = await nina.account.redeemable.fetch(redeemable);
    let encryptionPublicKeyAfter = Buffer.from(redeemableAfter.encryptionPublicKey);
    encryptionPublicKeyAfter = encryptionPublicKeyAfter.buffer.slice(
      encryptionPublicKeyAfter.byteOffset,
      encryptionPublicKeyAfter.byteOffset + encryptionPublicKeyAfter.byteLength
    );
    assert.ok(redeemableAfter.redeemedCount.toNumber() === 0)
    assert.ok(redeemableAfter.redeemedMax.toNumber() === 3)
    assert.ok(encrypt.decode(redeemableAfter.description) === description)
    assert.deepEqual(encryptionPublicKeyAfter, publisherEncryptionPublicKey)
  });

  const redemptionRecord = anchor.web3.Keypair.generate();
  let redeemerEncryptionPublicKey = null;
  let redeemerKeys = null;
  let iv = null;
  
  it('Redeems a redeemable', async () => {
    [redeemerEncryptionPublicKey, redeemerKeys] = await encrypt.exportPublicKey();
    const redeemerEncryptionPublicKeyBuffer = new Buffer.from(redeemerEncryptionPublicKey)

    let [redeemedTokenAccount, redeemedTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      user1.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      redeemedMint.publicKey,
    );

    const redemptionRecordIx = await nina.account.redemptionRecord.createInstruction(redemptionRecord);
    
    const addressObject = {
      name: 'John Smith',
      addressLine1: '123 Main St',
      addressLine2: "Apt 1",
      city: "New York",
      state: "NY",
      postalCode: "10002",
      country: "USA",
    }

    const addressString = Object.values(addressObject).join(",")

    const [encryptedData, _iv] = await encrypt.encryptData(addressString, publisherEncryptionPublicKey, redeemerKeys, 272)
    iv = _iv;
    await nina.rpc.redeemableRedeem(
      redeemerEncryptionPublicKeyBuffer,
      encryptedData,
      iv, {
        accounts: {
          redeemer: user1.publicKey,
          redeemableMint: releaseMint.publicKey,
          redeemedMint: redeemedMint.publicKey,
          redeemable,
          redeemableSigner,
          release,
          redemptionRecord: redemptionRecord.publicKey,
          redeemerRedeemableTokenAccount: purchaserReleaseTokenAccount,
          redeemerRedeemedTokenAccount: redeemedTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [user1, redemptionRecord],
        instructions: [
          redeemedTokenAccountIx,
          redemptionRecordIx,
        ],
      }
    );

    const redeemableAfter = await nina.account.redeemable.fetch(redeemable);
    assert.ok(redeemableAfter.redeemedCount.toNumber() === 1);

    const redemptionRecordAfter = await nina.account.redemptionRecord.fetch(redemptionRecord.publicKey);
    let encryptionPublicKeyAfter = Buffer.from(redemptionRecordAfter.encryptionPublicKey);
    encryptionPublicKeyAfter = encryptionPublicKeyAfter.buffer.slice(
      encryptionPublicKeyAfter.byteOffset,
      encryptionPublicKeyAfter.byteOffset + encryptionPublicKeyAfter.byteLength
    )
    assert.deepEqual(encryptionPublicKeyAfter, redeemerEncryptionPublicKey)

    const address = await encrypt.decryptData(redemptionRecordAfter.address, redeemerEncryptionPublicKey, iv, publisherKeys);
    assert.ok(address === addressString);

    const purchaserReleaseTokenAccountAfter = await getTokenAccount(
      provider,
      purchaserReleaseTokenAccount,
    );
    assert.ok(purchaserReleaseTokenAccountAfter.amount.toNumber() === 0);

    const redeemedTokenAccountAfter = await getTokenAccount(
      provider,
      redeemedTokenAccount,
    );
    assert.ok(redeemedTokenAccountAfter.amount.toNumber() === 1);
  });

  it('Should let Redeemable Authority update tracking information for redemption record', async () => {
    const shipper = "USPS";
    const trackingNumber = "12345678900987654567890";

    const [encryptedShipper] = await encrypt.encryptData(shipper, redeemerEncryptionPublicKey, publisherKeys, 32, iv)
    const [encryptedTrackingNumber] = await encrypt.encryptData(trackingNumber, redeemerEncryptionPublicKey, publisherKeys, 64, iv)

    await nina.rpc.redeemableShippingUpdate(
      encryptedShipper,
      encryptedTrackingNumber, {
        accounts: {
          authority: provider.wallet.publicKey,
          redeemable: redeemable,
          redemptionRecord: redemptionRecord.publicKey,
        }
      }
    );

    const redemptionRecordLookup = await nina.account.redemptionRecord.fetch(redemptionRecord.publicKey);
    const decryptedShipper = await encrypt.decryptData(redemptionRecordLookup.shipper, publisherEncryptionPublicKey, iv, redeemerKeys)
    const decryptedTrackingNumber = await encrypt.decryptData(redemptionRecordLookup.trackingNumber, publisherEncryptionPublicKey, iv, redeemerKeys)
    assert.ok(decryptedShipper === shipper);
    assert.ok(decryptedTrackingNumber === trackingNumber);
  });

it('Fails when redeeming more redeemables than available', async () => {
    [redeemerEncryptionPublicKey, redeemerKeys] = await encrypt.exportPublicKey();
    const redeemerEncryptionPublicKeyBuffer = new Buffer.from(redeemerEncryptionPublicKey)

    let [redeemedTokenAccount, redeemedTokenAccountIx] = await findOrCreateAssociatedTokenAccount(
      provider,
      user1.publicKey,
      anchor.web3.SystemProgram.programId,
      anchor.web3.SYSVAR_RENT_PUBKEY,
      redeemedMint.publicKey,
    );
    
    const addressObject = {
      name: 'John Smith',
      addressLine1: '123 Main St',
      addressLine2: "Apt 1",
      city: "New York",
      state: "NY",
      postalCode: "10002",
      country: "USA",
    }

    const addressString = Object.values(addressObject).join(",")

    const [encryptedData, _iv] = await encrypt.encryptData(addressString, publisherEncryptionPublicKey, redeemerKeys, 272)
    iv = _iv;

    const createGenerator = function*() {
      let i = 0;
      while(i < 5) {
        yield await Promise.resolve(i++);
      }
    }
    const generator = createGenerator();

    await assert.rejects(
      async () => {
        for await (let item of generator) {
          await nina.rpc.releasePurchase(
            new anchor.BN(releasePrice), {
              accounts: {
                release,
                releaseSigner,
                payer: user1.publicKey,
                payerTokenAccount: user1UsdcTokenAccount,
                purchaser: user1.publicKey,
                purchaserReleaseTokenAccount: purchaserReleaseTokenAccount,
                royaltyTokenAccount,
                releaseMint: releaseMint.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
              },
              signers: [user1],
            }
          );

          const redemptionRecord = anchor.web3.Keypair.generate();
          const redemptionRecordIx = await nina.account.redemptionRecord.createInstruction(redemptionRecord);
          await nina.rpc.redeemableRedeem(
            redeemerEncryptionPublicKeyBuffer,
            encryptedData,
            iv, {
              accounts: {
                redeemer: user1.publicKey,
                redeemableMint: releaseMint.publicKey,
                redeemedMint: redeemedMint.publicKey,
                redeemable,
                redeemableSigner,
                release,
                redemptionRecord: redemptionRecord.publicKey,
                redeemerRedeemableTokenAccount: purchaserReleaseTokenAccount,
                redeemerRedeemedTokenAccount: redeemedTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                systemProgram: anchor.web3.SystemProgram.programId,
              },
              signers: [user1, redemptionRecord],
              instructions: [
                redemptionRecordIx,
              ],
            }
          );
        }
      },
      (err) => {
        assert.equal(err.code, 310);
        assert.equal(err.msg, "No more redeemables available");
        return true;
      }
    );
  });

  it('Updates a redeemable', async () => {
    [publisherEncryptionPublicKey, publisherKeys] = await encrypt.exportPublicKey();
    const encryptionPublicKeyBuffer = new Buffer.from(publisherEncryptionPublicKey)

    const [redeemable, redeemableBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("nina-redeemable")), release.toBuffer(), redeemedMint.publicKey.toBuffer()],
      nina.programId
    );    
    const redeeemableAccount = await nina.account.redeemable.fetch(redeemable)
    const config = {
      encryptionPublicKey: encryptionPublicKeyBuffer,
      description: encrypt.decode(redeeemableAccount.description),
      redeemedMax: redeeemableAccount.redeemedMax,
    };

    await nina.rpc.redeemableUpdateConfig(
      config,{
        accounts: {
          authority: provider.wallet.publicKey,
          release,
          redeemable,
          redeemableSigner: redeeemableAccount.redeemableSigner,
          redeemableMint: releaseMint.publicKey,
          redeemedMint: redeemedMint.publicKey,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      }
    )

    const redeemableAfter = await nina.account.redeemable.fetch(redeemable);
    let encryptionPublicKeyBefore = Buffer.from(redeeemableAccount.encryptionPublicKey);
    encryptionPublicKeyBefore = encryptionPublicKeyBefore.buffer.slice(
      encryptionPublicKeyBefore.byteOffset,
      encryptionPublicKeyBefore.byteOffset + encryptionPublicKeyBefore.byteLength
    );

    let encryptionPublicKeyAfter = Buffer.from(redeemableAfter.encryptionPublicKey);
    encryptionPublicKeyAfter = encryptionPublicKeyAfter.buffer.slice(
      encryptionPublicKeyAfter.byteOffset,
      encryptionPublicKeyAfter.byteOffset + encryptionPublicKeyAfter.byteLength
    );
    assert.ok(encryptionPublicKeyBefore !== encryptionPublicKeyAfter)
    assert.deepEqual(encryptionPublicKeyAfter, publisherEncryptionPublicKey)
  });
});

describe('Vault', async () => {
  it('Withdraws From the Vault to Vault Authority', async () => {
    const vaultUsdcTokenAccountBefore = await getTokenAccount(
      provider,
      vaultUsdcTokenAccount,
    );
    const vaultUsdcTokenAccountBeforeBalance = vaultUsdcTokenAccountBefore.amount.toNumber();

    const usdcTokenAccountBefore = await getTokenAccount(
      provider,
      usdcTokenAccount,
    );
    const usdcTokenAccountBeforeBalance = usdcTokenAccountBefore.amount.toNumber();

    const withdrawAmount = vaultUsdcTokenAccountBefore.amount.toNumber();

    await nina.rpc.vaultWithdraw(
      new anchor.BN(withdrawAmount), {
        accounts: {
          authority: provider.wallet.publicKey,
          vault,
          vaultSigner,
          withdrawTarget: vaultUsdcTokenAccount,
          withdrawDestination: usdcTokenAccount,
          withdrawMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        }
      }
    );

    const vaultUsdcTokenAccountAfter = await getTokenAccount(
      provider,
      vaultUsdcTokenAccount,
    );
    const vaultUsdcTokenAccountAfterBalance = vaultUsdcTokenAccountAfter.amount.toNumber();

    assert.ok(vaultUsdcTokenAccountAfterBalance === vaultUsdcTokenAccountBeforeBalance - withdrawAmount)
    const usdcTokenAccountAfter = await getTokenAccount(
      provider,
      usdcTokenAccount,
    );
    const usdcTokenAccountAfterBalance = usdcTokenAccountAfter.amount.toNumber();
    assert.ok(usdcTokenAccountAfterBalance === usdcTokenAccountBeforeBalance + withdrawAmount)
  })

  it('should not allow withdraw from non-authority', async () => {
    const vaultWrappedSolTokenAccountBefore = await getTokenAccount(
      provider,
      vaultWrappedSolTokenAccount,
    );

    const withdrawAmount = vaultWrappedSolTokenAccountBefore.amount.toNumber();

    await assert.rejects(
      async () => {
        await nina.rpc.vaultWithdraw(
          new anchor.BN(withdrawAmount), {
            accounts: {
              authority: user1.publicKey,
              vault,
              vaultSigner,
              withdrawTarget: vaultWrappedSolTokenAccount,
              withdrawDestination: user1WrappedSolTokenAccount,
              withdrawMint: wrappedSolMint,
              tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [user1],
          }
        );
      },
      (err) => {
        assert.equal(err.code, 143);
        assert.equal(err.msg, "A raw constraint was violated");
        return true;
      }
    );
  });

  it('should not allow withdraw with amount greater than balance', async () => {
    const vaultWrappedSolTokenAccountBefore = await getTokenAccount(
      provider,
      vaultWrappedSolTokenAccount,
    );

    const withdrawAmount = vaultWrappedSolTokenAccountBefore.amount.toNumber();

    await assert.rejects(
      async () => {
        await nina.rpc.vaultWithdraw(
          new anchor.BN(withdrawAmount * 2), {
            accounts: {
              authority: provider.wallet.publicKey,
              vault,
              vaultSigner,
              withdrawTarget: vaultWrappedSolTokenAccount,
              withdrawDestination: wrappedSolTokenAccount,
              withdrawMint: wrappedSolMint,
              tokenProgram: TOKEN_PROGRAM_ID,
            },
          }
        );
      },
      (err) => {
        assert.equal(err.code, 319);
        assert.equal(err.msg, "Cant withdraw more than deposited");
        return true;
      }
    );
  });

  it('should not allow withdraw with amount 0', async () => {
    await assert.rejects(
      async () => {
        await nina.rpc.vaultWithdraw(
          new anchor.BN(0), {
            accounts: {
              authority: provider.wallet.publicKey,
              vault,
              vaultSigner,
              withdrawTarget: vaultWrappedSolTokenAccount,
              withdrawDestination: wrappedSolTokenAccount,
              withdrawMint: wrappedSolMint,
              tokenProgram: TOKEN_PROGRAM_ID,
            },
          }
        );
      },
      (err) => {
        assert.equal(err.code, 320);
        assert.equal(err.msg, "Withdraw amount must be greater than 0");
        return true;
      }
    );
  });

})