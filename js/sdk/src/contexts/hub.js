import React, { createContext, useContext, useState, useEffect } from 'react'
import * as anchor from '@project-serum/anchor'
import axios from 'axios'
import { ninaErrorHandler } from '../utils/errors'
import {
  findAssociatedTokenAddress,
  findOrCreateAssociatedTokenAccount,
} from '../utils/web3'
import { decodeNonEncryptedByteArray } from '../utils/encrypt'
import { ReleaseContext } from './release'
import { NinaContext } from './nina'

export const HubContext = createContext()
const HubContextProvider = ({ children }) => {
  const { fetchAndSaveReleasesToState, releaseState } = useContext(ReleaseContext)
  const { ninaClient, savePostsToState, postState } = useContext(NinaContext)
  const [hubState, setHubState] = useState({})
  const [hubCollaboratorsState, setHubCollaboratorsState] = useState({})
  const [hubContentState, setHubContentState] = useState({})
  const [hubFeePending, setHubFeePending] = useState()
  const {
    getHubs,
    getHub,
    getHubContent,
    hubInitWithCredit,
    hubUpdateConfig,
    hubAddCollaborator,
    hubUpdateCollaboratorPermission,
    hubAddRelease,
    hubRemoveCollaborator,
    hubContentToggleVisibility,
    hubWithdraw,
    postInitViaHub,
    postUpdateViaHubPost,
    filterHubCollaboratorsForHub,
    filterHubContentForHub,
    filterHubsForUser
  } = hubContextHelper({
    ninaClient,
    savePostsToState,
    hubState,
    setHubState,
    hubCollaboratorsState,
    setHubCollaboratorsState,
    hubContentState,
    setHubContentState,
    fetchAndSaveReleasesToState,
    setHubFeePending,
    postState
  })

  return (
    <HubContext.Provider
      value={{
        getHubs,
        getHub,
        hubInitWithCredit,
        hubUpdateConfig,
        hubAddCollaborator,
        hubUpdateCollaboratorPermission,
        hubAddRelease,
        hubRemoveCollaborator,
        hubContentToggleVisibility,
        hubWithdraw,
        postInitViaHub,
        postUpdateViaHubPost,
        hubState,
        hubCollaboratorsState,
        hubContentState,
        hubFeePending,
        filterHubCollaboratorsForHub,
        filterHubContentForHub,
        filterHubsForUser  
      }}
    >
      {children}
    </HubContext.Provider>
  )
}

const hubContextHelper = ({
  ninaClient,
  savePostsToState,
  hubState,
  setHubState,
  hubCollaboratorsState,
  setHubCollaboratorsState,
  hubContentState,
  setHubContentState,
  fetchAndSaveReleasesToState,
  setHubFeePending,
  postState
}) => {
  const { ids, provider, endpoints } = ninaClient

  const hubInitWithCredit = async (hubParams) => {
    try {
      const program = await ninaClient.useProgram()
      const USDC_MINT = new anchor.web3.PublicKey(ids.mints.usdc)
      const WRAPPED_SOL_MINT = new anchor.web3.PublicKey(ids.mints.wsol)
      const HUB_CREDIT_MINT = new anchor.web3.PublicKey(ids.mints.hubCredit)

      hubParams.publishFee = new anchor.BN(hubParams.publishFee * 10000)
      hubParams.referralFee = new anchor.BN(hubParams.referralFee * 10000)
      const [hub] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub')),
          Buffer.from(anchor.utils.bytes.utf8.encode(hubParams.handle)),
        ],
        program.programId
      )

      const [hubSigner, hubSignerBump] =
        await anchor.web3.PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-signer')),
            hub.toBuffer(),
          ],
          program.programId
        )
      hubParams.hubSignerBump = hubSignerBump

      const [hubCollaborator] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-collaborator')),
          hub.toBuffer(),
          provider.wallet.publicKey.toBuffer(),
        ],
        program.programId
      )

      let [, usdcVaultIx] = await findOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.publicKey,
        hubSigner,
        anchor.web3.SystemProgram.programId,
        anchor.web3.SYSVAR_RENT_PUBKEY,
        USDC_MINT
      )

      let [, wrappedSolVaultIx] = await findOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.publicKey,
        hubSigner,
        anchor.web3.SystemProgram.programId,
        anchor.web3.SYSVAR_RENT_PUBKEY,
        WRAPPED_SOL_MINT
      )

      let [authorityHubCreditTokenAccount] =
        await findOrCreateAssociatedTokenAccount(
          provider.connection,
          provider.wallet.publicKey,
          provider.wallet.publicKey,
          anchor.web3.SystemProgram.programId,
          anchor.web3.SYSVAR_RENT_PUBKEY,
          HUB_CREDIT_MINT
        )

      //add IX for create
      const txid = await program.methods
        .hubInitWithCredit(hubParams)
        .accounts({
          authority: provider.wallet.publicKey,
          hub,
          hubSigner,
          hubCollaborator,
          authorityHubCreditTokenAccount,
          hubCreditMint: HUB_CREDIT_MINT,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: ids.programs.token,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .preInstructions([usdcVaultIx, wrappedSolVaultIx])
        .rpc()

      await provider.connection.getParsedConfirmedTransaction(txid, 'finalized')
      await getHub(hub)

      return {
        success: true,
        msg: 'Hub Created',
        hubPubkey: hub,
      }
    } catch (error) {
      return ninaErrorHandler(error)
    }
  }

  const hubUpdateConfig = async (uri, publishFee, referralFee) => {
    const hub = hubState[hubPubkey]
    const program = await ninaClient.useProgram()
    hubPubkey = new anchor.web3.PublicKey(hubPubkey)

    try {
      const txid = await program.rpc.hubUpdateConfig(
        uri,
        hub.handle,
        publishFee,
        referralFee,
        {
          accounts: {
            authority: provider.wallet.publicKey,
            hub: hubPubkey,
          },
        }
      )

      await provider.connection.getParsedConfirmedTransaction(txid, 'confirmed')
      await getHub(hub)

      return {
        success: true,
        msg: 'Hub Updated',
        hubPubkey: hub,
      }
    } catch (error) {
      return ninaErrorHandler(error)
    }
  }

  const hubAddCollaborator = async (
    collaboratorPubkey,
    hubPubkey,
    canAddContent,
    canAddCollaborator,
    allowance = 1
  ) => {
    try {
      const hub = hubState[hubPubkey]
      const program = await ninaClient.useProgram()
      collaboratorPubkey = new anchor.web3.PublicKey(collaboratorPubkey)
      hubPubkey = new anchor.web3.PublicKey(hubPubkey)
      const [hubCollaborator] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-collaborator')),
          hubPubkey.toBuffer(),
          collaboratorPubkey.toBuffer(),
        ],
        program.programId
      )
      const [authorityHubCollaborator] =
        await anchor.web3.PublicKey.findProgramAddress(
          [
            Buffer.from(
              anchor.utils.bytes.utf8.encode('nina-hub-collaborator')
            ),
            hubPubkey.toBuffer(),
            provider.wallet.publicKey.toBuffer(),
          ],
          program.programId
        )

      const txid = await program.rpc.hubAddCollaborator(
        canAddContent,
        canAddCollaborator,
        allowance,
        hub.handle,
        {
          accounts: {
            authority: provider.wallet.publicKey,
            authorityHubCollaborator,
            hub: hubPubkey,
            hubCollaborator,
            collaborator: collaboratorPubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          },
        }
      )

      await provider.connection.getParsedConfirmedTransaction(txid, 'confirmed')

      await getHub(hubPubkey)

      return {
        success: true,
        msg: 'Collaborator Added to hub',
      }
    } catch (error) {
      return ninaErrorHandler(error)
    }
  }

  const hubUpdateCollaboratorPermission = async (
    collaboratorPubkey,
    hubPubkey,
    canAddContent,
    canAddCollaborator,
    allowance = 1
  ) => {
    try {
      const hub = hubState[hubPubkey]
      const program = await ninaClient.useProgram()
      collaboratorPubkey = new anchor.web3.PublicKey(collaboratorPubkey)
      hubPubkey = new anchor.web3.PublicKey(hubPubkey)

      const [hubCollaborator] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-collaborator')),
          hubPubkey.toBuffer(),
          collaboratorPubkey.toBuffer(),
        ],
        program.programId
      )

      const [authorityHubCollaborator] =
        await anchor.web3.PublicKey.findProgramAddress(
          [
            Buffer.from(
              anchor.utils.bytes.utf8.encode('nina-hub-collaborator')
            ),
            hubPubkey.toBuffer(),
            provider.wallet.publicKey.toBuffer(),
          ],
          program.programId
        )

      const txid = await program.rpc.hubUpdateCollaboratorPermissions(
        canAddContent,
        canAddCollaborator,
        allowance,
        hub.handle,
        {
          accounts: {
            authority: provider.wallet.publicKey,
            authorityHubCollaborator,
            hub: hubPubkey,
            hubCollaborator,
            collaborator: collaboratorPubkey,
          },
        }
      )

      await provider.connection.getParsedConfirmedTransaction(txid, 'confirmed')

      await getHub(hubPubkey)

      return {
        success: true,
        msg: 'Hub Collaborator Permissions Updated',
      }
    } catch (error) {
      return ninaErrorHandler(error)
    }
  }

  const hubAddRelease = async (hubPubkey, releasePubkey) => {
    try {
      const hub = hubState[hubPubkey]
      const program = await ninaClient.useProgram()
      hubPubkey = new anchor.web3.PublicKey(hubPubkey)
      releasePubkey = new anchor.web3.PublicKey(releasePubkey)
      const [hubRelease] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-release')),
          hubPubkey.toBuffer(),
          releasePubkey.toBuffer(),
        ],
        program.programId
      )

      const [hubContent] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-content')),
          hubPubkey.toBuffer(),
          releasePubkey.toBuffer(),
        ],
        program.programId
      )

      const [hubCollaborator] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-collaborator')),
          hubPubkey.toBuffer(),
          provider.wallet.publicKey.toBuffer(),
        ],
        program.programId
      )

      const txid = await program.rpc.hubAddRelease(hub.handle, {
        accounts: {
          authority: provider.wallet.publicKey,
          hub: hubPubkey,
          hubRelease,
          hubContent,
          hubCollaborator,
          release: releasePubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
      })
      await provider.connection.getParsedConfirmedTransaction(txid, 'confirmed')

      await getHub(hubPubkey)

      return {
        success: true,
        msg: 'Release Added to Hub',
      }
    } catch (error) {
      return ninaErrorHandler(error)
    }
  }

  const hubRemoveCollaborator = async (hubPubkey, collaboratorPubkey) => {
    try {
      const hub = hubState[hubPubkey]
      const program = await ninaClient.useProgram()
      hubPubkey = new anchor.web3.PublicKey(hubPubkey)
      collaboratorPubkey = new anchor.web3.PublicKey(collaboratorPubkey)
      const [hubCollaborator] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-collaborator')),
          hubPubkey.toBuffer(),
          collaboratorPubkey.toBuffer(),
        ],
        program.programId
      )

      const txid = await program.rpc.hubRemoveCollaborator(hub.handle, {
        accounts: {
          authority: provider.wallet.publicKey,
          hub: hubPubkey,
          hubCollaborator,
          collaborator: collaboratorPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      })
      await provider.connection.getParsedConfirmedTransaction(txid, 'confirmed')

      await getHub(hubPubkey)

      return {
        success: true,
        msg: 'Collaborator Removed From Hub',
      }
    } catch (error) {
      return ninaErrorHandler(error)
    }
  }

  const hubContentToggleVisibility = async (
    hubPubkey,
    contentAccountPubkey,
    type
  ) => {
    try {
      const hub = hubState[hubPubkey]
      const program = await ninaClient.useProgram()
      hubPubkey = new anchor.web3.PublicKey(hubPubkey)
      contentAccountPubkey = new anchor.web3.PublicKey(contentAccountPubkey)

      const [hubContent] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-content')),
          hubPubkey.toBuffer(),
          contentAccountPubkey.toBuffer(),
        ],
        program.programId
      )
      const txid = await program.rpc.hubContentToggleVisibility(hub.handle, {
        accounts: {
          authority: provider.wallet.publicKey,
          hub: hubPubkey,
          hubContent,
          contentAccount: contentAccountPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      })
      await provider.connection.getParsedConfirmedTransaction(txid, 'confirmed')

      await getHub(hubPubkey)
      return {
        success: true,
        msg: `${type} has been archived`,
      }
    } catch (error) {
      return ninaErrorHandler(error)
    }
  }

  const hubWithdraw = async (hubPubkey) => {
    try {
      const hub = hubState[hubPubkey]
      const program = await ninaClient.useProgram()
      hubPubkey = new anchor.web3.PublicKey(hubPubkey)
      const USDC_MINT = new anchor.web3.PublicKey(ids.mints.usdc)

      const [hubSigner, hubSignerBump] =
        await anchor.web3.PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-signer')),
            hubPubkey.toBuffer(),
          ],
          program.programId
        )

      let [withdrawTarget] = await findOrCreateAssociatedTokenAccount(
        provider,
        hubSigner,
        anchor.web3.SystemProgram.programId,
        anchor.web3.SYSVAR_RENT_PUBKEY,
        USDC_MINT
      )

      let [withdrawDestination] = await findOrCreateAssociatedTokenAccount(
        provider,
        provider.wallet.publicKey,
        anchor.web3.SystemProgram.programId,
        anchor.web3.SYSVAR_RENT_PUBKEY,
        USDC_MINT
      )

      let tokenAccounts =
        await provider.connection.getParsedTokenAccountsByOwner(hubSigner, {
          mint: USDC_MINT,
        })

      const withdrawAmount =
        tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount

      const txid = await program.rpc.hubWithdraw(
        new anchor.BN(withdrawAmount),
        hubSignerBump,
        hub.name,
        {
          accounts: {
            authority: provider.wallet.publicKey,
            hub: hubPubkey,
            hubSigner,
            withdrawTarget,
            withdrawDestination,
            withdrawMint: USDC_MINT,
            tokenProgram: ids.programs.token,
          },
        }
      )
      await provider.connection.getParsedConfirmedTransaction(txid, 'confirmed')

      await getHub(hubPubkey)
      return {
        success: true,
        msg: 'Withdraw from Hub Successful.',
      }
    } catch (error) {
      return ninaErrorHandler(error)
    }
  }

  const postInitViaHub = async (
    hubPubkey,
    slug,
    uri,
    referenceRelease = undefined
  ) => {
    try {
      const program = await ninaClient.useProgram()
      const hub = await program.account.hub.fetch(hubPubkey)
      hubPubkey = new anchor.web3.PublicKey(hubPubkey)

      const [post] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-post')),
          hubPubkey.toBuffer(),
          Buffer.from(anchor.utils.bytes.utf8.encode(slug)),
        ],
        program.programId
      )

      const [hubPost] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-post')),
          hubPubkey.toBuffer(),
          post.toBuffer(),
        ],
        program.programId
      )

      const [hubContent] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-content')),
          hubPubkey.toBuffer(),
          post.toBuffer(),
        ],
        program.programId
      )

      const [hubCollaborator] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-collaborator')),
          hubPubkey.toBuffer(),
          provider.wallet.publicKey.toBuffer(),
        ],
        program.programId
      )
      const accounts = {
        author: provider.wallet.publicKey,
        hub: hubPubkey,
        post,
        hubPost,
        hubContent,
        hubCollaborator,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      }

      let txid
      const params = [hub.handle, slug, uri]
      const request = { accounts }
      if (referenceRelease) {
        accounts.referenceRelease = referenceRelease

        const instructions = []
        const [referenceReleaseHubRelease, referenceReleaseHubReleaseIx] =
          await anchor.web3.PublicKey.findProgramAddress(
            [
              Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-release')),
              hubPubkey.toBuffer(),
              referenceRelease.toBuffer(),
            ],
            program.programId
          )
        request.accounts.referenceReleaseHubRelease = referenceReleaseHubRelease

        if (referenceReleaseHubReleaseIx) {
          instructions.push(referenceReleaseHubReleaseIx)
        }
  
        const [referenceReleaseHubContent, referenceReleaseHubContentIx] =
          await anchor.web3.PublicKey.findProgramAddress(
            [
              Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-content')),
              hubPubkey.toBuffer(),
              referenceRelease.toBuffer(),
            ],
            program.programId
          )
        request.accounts.referenceReleaseHubContent = referenceReleaseHubContent

        if (referenceReleaseHubContentIx) {
          instructions.push(referenceReleaseHubContentIx)
        }

        if (instructions.length > 0) {
          request.instructions = instructions
        }
        txid = await program.rpc.postInitViaHubWithReferenceContent(...params, request)
      } else {
        txid = await program.rpc.postInitViaHub(...params, request)
      }
      await provider.connection.getParsedConfirmedTransaction(txid, 'confirmed')
      await getHub(hubPubkey)

      return {
        success: true,
        msg: 'Post created.',
      }
    } catch (error) {
      return ninaErrorHandler(error)
    }
  }

  const postUpdateViaHubPost = async (hubPubkey, slug, uri) => {
    try {
      const program = await ninaClient.useProgram()
      const hub = await program.account.hub.fetch(hubPubkey)
      hubPubkey = new anchor.web3.PublicKey(hubPubkey)

      const [post] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-post')),
          hubPubkey.toBuffer(),
          Buffer.from(anchor.utils.bytes.utf8.encode(slug)),
        ],
        program.programId
      )

      const [hubPost] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-post')),
          hubPubkey.toBuffer(),
          post.toBuffer(),
        ],
        program.programId
      )

      const [hubCollaborator] = await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('nina-hub-collaborator')),
          hubPubkey.toBuffer(),
          provider.wallet.publicKey.toBuffer(),
        ],
        program.programId
      )

      const txid = await program.rpc.postUpdateViaHubPost(
        hub.handle,
        slug,
        uri,
        {
          accounts: {
            author: provider.wallet.publicKey,
            hub: hubPubkey,
            post,
            hubPost,
            hubCollaborator,
          },
        }
      )

      await provider.connection.getParsedConfirmedTransaction(txid, 'confirmed')
      await getHub(hubPubkey)

      return {
        success: true,
        msg: 'Post updated.',
      }
    } catch (error) {
      return ninaErrorHandler(error)
    }
  }

  const getHubs = async () => {
    try {
      let path = endpoints.api + `/hubs`
      const response = await fetch(path)
      const result = await response.json()
      saveHubsToState(result.hubs)
    } catch (error) {
      console.warn(error)
    }
  }

  const getHub = async (hubPubkey) => {
    const program = await ninaClient.useProgram()
    const hub = await program.account.hub.fetch(hubPubkey)
    let hubTokenAccount = await findAssociatedTokenAddress(
      hub.hubSigner,
      new anchor.web3.PublicKey(ids.mints.usdc)
    )
    const hubFeePendingAmount =
      await provider.connection.getTokenAccountBalance(hubTokenAccount)
    setHubFeePending(hubFeePendingAmount)
    saveHubsToState([hub])
    getHubContent(hubPubkey)
  }
  
  const getHubContent = async (hubPubkey) => {
    let path = endpoints.api + `/hubs/${hubPubkey}`
    const response = await fetch(path)
    const result = await response.json()
    console.log(result)
    saveHubCollaboratorsToState(result.hubCollaborators)
    saveHubContentToState(result.hubReleases, result.hubPosts)
  }

  const getHubsForUser = (publicKey) => {
    let path = endpoints.api + `/hubCollaboratorss/${publicKey}/hubs`
    const response = await fetch(path)
    const result = await response.json()
    saveHubCollaboratorsToState(result.hubCollaborators)
    saveHubsToState(result.hubs)
  }
  /*

  STATE

  */

  const saveHubsToState = async (hubs) => {
    try {
      let updatedState = { ...hubState }
      hubs.forEach(hub => {
        hub.publicKey = hub.id
        updatedState[hub.publicKey] = hub
      })
      setHubState(updatedState)
    } catch (error) {
      console.warn(error)
    }
  }

  const saveHubCollaboratorsToState = async (hubCollaborators) => {
    try {
      let updatedState = {...hubCollaboratorsState}
      for (let hubCollaborator of hubCollaborators) {
        updatedState = {
          ...updatedState,
          [hubCollaborator.id]: {
            ...hubCollaborator,
            publicKey: hubCollaborator.id,
          },
        }
      }
      console.log("updatedState rsdsd ::> ", updatedState)
      setHubCollaboratorsState(updatedState)
    } catch (error) {
      console.warn(error)
    }
  }

  const saveHubContentToState = async (hubReleases, hubPosts) => {
    try {
      let updatedState = { ...hubContentState }
      let contentState = {}
      for (let hubRelease of hubReleases) {
        contentState = {
          ...contentState,
          [hubRelease.id]: {
            addedBy: hubRelease.addedBy,
            child: hubRelease.id,
            contentType: 'NinaReleaseV1',
            datetime: hubRelease.datetime,
            publicKeyHubContent: hubRelease.hubContent,
            hub: hubRelease.hubId,
            release: hubRelease.releaseId,
            publicKey: hubRelease.id,
            publishedThroughHub: hubRelease.publishedThroughHub,
            visible: hubRelease.visible,
          }
        }
      }

      for (let hubPost of hubPosts) {
        contentState = {
          ...contentState,
          [hubPost.id]: {
            addedBy: hubPost.addedBy,
            child: hubPost.id,
            contentType: 'Post',
            datetime: hubPost.datetime,
            publicKeyHubContent: hubPost.hubContent,
            hub: hubPost.hubId,
            post: hubPost.postId,
            publicKey: hubPost.id,
            publishedThroughHub: hubPost.publishedThroughHub,
            visible: hubPost.visible,
            referenceHubContent: hubPost.referenceContent,
            referenceHubContentType: hubPost.referenceContentType,
            versionUri: hubPost.post.uri,
          }
        }
      }
      updatedState = {
        ...updatedState,
        ...contentState,
      }
      await fetchAndSaveReleasesToState(hubReleases.map(hubRelease => hubRelease.releaseId))
      console.log("hubPosts ::> ", hubPosts)
      await savePostsToState(hubPosts.map((hubPost) => hubPost.post))

      setHubContentState(updatedState)
    } catch (error) {
      console.warn(error)
    }
  }

  const filterHubContentForHub = (hubPubkey) => {
    const hubReleases = []
    const hubPosts = []

    Object.values(hubContentState).forEach((hubContent) => {
      console.log("hubContent ::> ", hubContent)
      if (hubContent.hub === hubPubkey) {
        console.log("1 ::> ")
        if (hubContent.contentType === 'NinaReleaseV1') {
          console.log("2 ::> ")
          hubReleases.push(hubContent)
        } else if (hubContent.contentType === 'Post') {
          console.log("3 ::> ")
          hubPosts.push(hubContent)
        }
      }
    })

    return [
      hubReleases,
      hubPosts
    ]
  }

  const filterHubCollaboratorsForHub = (hubPubkey) => {
    const hubCollaborators = []
    Object.values(hubCollaboratorsState).forEach(hubCollaborator => {
      if (hubCollaborator.hubId === hubPubkey) {
        hubCollaborators.push(hubCollaborator)
      }
    })
    return hubCollaborators.sort((a,b) => b.datetime - a.datetime)
  }

  const filterHubsForUser = (publicKey) => {
    const hubs = []
    Object.values(hubCollaboratorsState).forEach(hubCollaborator => {
      if (hubCollaborator.collaborator === publicKey) {
        hubs.push(hubState[hubCollaborator.hubId])
      }
    })
    return hubs
  }

  return {
    getHubs,
    getHub,
    getHubContent,
    hubInitWithCredit,
    hubUpdateConfig,
    hubAddCollaborator,
    hubUpdateCollaboratorPermission,
    hubAddRelease,
    hubRemoveCollaborator,
    hubContentToggleVisibility,
    hubWithdraw,
    postInitViaHub,
    postUpdateViaHubPost,
    filterHubCollaboratorsForHub,
    filterHubContentForHub,
    filterHubsForUser
  }
}
export default HubContextProvider