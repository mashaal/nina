import React, {
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from 'react'
import * as Yup from 'yup'
import nina from '@nina-protocol/nina-sdk'
import { useSnackbar } from 'notistack'
import { styled } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Modal from '@mui/material/Modal'
import Backdrop from '@mui/material/Backdrop'
import Fade from '@mui/material/Fade'
import { useWallet } from '@solana/wallet-adapter-react'
import HubPostCreateForm from './HubPostCreateForm'

import Dots from './Dots'
import Grid from '@mui/material/Grid'
import BundlrModal from './BundlrModal'
import {
  createUpload,
  updateUpload,
  removeUpload,
  UploadType,
  uploadHasItemForType,
} from '../utils/uploadManager'

const { NinaContext, HubContext } = nina.contexts

const PostCreateSchema = Yup.object().shape({
  title: Yup.string().required('Title is Required'),
  body: Yup.string().required('Body is Required'),
  reference: Yup.string(),
})

const HubPostCreate = ({
  update,
  hubPubkey,
  canAddContent,
  hubReleasesToReference,
  preloadedRelease,
  selectedHubId,
  setParentOpen
}) => {
  const { enqueueSnackbar } = useSnackbar()
  const wallet = useWallet()
  const { postInitViaHub, hubState } = useContext(HubContext)
  const hubData = useMemo(() => hubState[hubPubkey || selectedHubId], [hubState, hubPubkey, selectedHubId])
  const {
    bundlrUpload,
    bundlrBalance,
    getBundlrBalance,
    bundlrFund,
    bundlrWithdraw,
    getBundlrPricePerMb,
    bundlrPricePerMb,
    solPrice,
    getSolPrice,
  } = useContext(NinaContext)
  const [uploadSize, setUploadSize] = useState()
  const [buttonText, setButtonText] = useState(
    update ? 'Update Post' : 'Create Post'
  )
  const [pending, setPending] = useState(false)
  const [formIsValid, setFormIsValid] = useState(false)
  const [formValues, setFormValues] = useState({
    postForm: {},
  })
  const [formValuesConfirmed, setFormValuesConfirmed] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [metadataTx, setMetadataTx] = useState()
  const [postCreated, setPostCreated] = useState(false)
  const [uploadId, setUploadId] = useState()
  const [publishingStepText, setPublishingStepText] = useState()
  const [open, setOpen] = useState(false)

  const mbs = useMemo(
    () => bundlrBalance / bundlrPricePerMb,
    [bundlrBalance, bundlrPricePerMb]
  )
  const bundlrUsdBalance = useMemo(
    () => bundlrBalance * solPrice,
    [bundlrBalance, solPrice]
  )


  useEffect(() => {
    refreshBundlr()
  }, [])

  const refreshBundlr = () => {
    getBundlrPricePerMb()
    getBundlrBalance()
    getSolPrice()
  }

  useEffect(() => {
    if (canAddContent) {
      if (!update) {
        if (!metadataTx) {
          setPublishingStepText(
            '1/2 Uploading Metadata.  Please confirm in wallet and do not close this window.'
          )
        } else {
          setPublishingStepText(
            '2/2 Finalizing Post.  Please confirm in wallet and do not close this window.'
          )
        }
      } else {
        if (!metadataTx) {
          setButtonText('Restart 2/3: Upload Metadata.')
        } else if (artworkTx && !metadataTx) {
          setButtonText('Restart 3/4: Upload Metadata.')
        } else if (artworkTx && metadataTx && !hubCreated) {
          setButtonText('Restart 4/4: Finalize Hub')
        } else if (mbs < uploadSize) {
          setButtonText(
            `Release requires more storage than available in your bundlr account, please top up`
          )
        }
      }
    } else {
      setButtonText(preloadedRelease ? `Create Post on ${hubData?.json.displayName}` : `You do not have permission to create posts`)
    }
  }, [metadataTx, isPublishing, postCreated, bundlrBalance, canAddContent, hubData])

  const handleFormChange = useCallback(
    async (values) => {
      setFormValues({
        ...formValues,
        postForm: values,
      })
    },
    [formValues]
  )

  useEffect(() => {
    if (update) {
      setFormIsValid(true)
      return
    }
    const valid = async () => {
      const isValid = await PostCreateSchema.isValid(formValues.postForm, {
        abortEarly: true,
      })
      setFormIsValid(isValid)
    }
    valid()
  }, [formValues])

  const handleSubmit = async () => {
    try {
      setPostCreated(false)

      if (update) {
        //update function
      } else {
        let upload = uploadId
        if (!uploadId) {
          setIsPublishing(true)
          enqueueSnackbar(
            'Uploading Post to Arweave.  Please confirm in wallet.',
            {
              variant: 'info',
            }
          )
          let metadataResult = metadataTx
          const metadataJson = {
            title: formValues.postForm.title,
            body: formValues.postForm.body,
          }

          if (formValues.postForm.reference) {
            metadataJson.reference = formValues.postForm.reference
          }

          if (preloadedRelease) {
            metadataJson.reference = preloadedRelease
            formValues.postForm.reference = preloadedRelease
          }
          
          metadataResult = (
            await bundlrUpload(
              new Blob([JSON.stringify(metadataJson)], {
                type: 'application/json',
              })
            )
          ).data.id

          setMetadataTx(metadataResult)

          upload = createUpload(
            UploadType.metadata,
            metadataResult,
            formValues.postForm
          )
          setUploadId(upload)

          const uri = 'https://arweave.net/' + metadataResult
          const slug = `${hubData.handle
            .toLowerCase()
            .replace(' ', '_')}_${Math.round(new Date().getTime() / 1000)}`

          let result

          if (metadataJson.reference) {
            result = await postInitViaHub(
              hubPubkey || selectedHubId,
              slug,
              uri,
              metadataJson.reference
            )
          } else {
            result = await postInitViaHub(hubPubkey, slug, uri)
          }

          if (result?.success) {
            enqueueSnackbar(result.msg, {
              variant: 'info',
            })
          } else {
            enqueueSnackbar('Post not created', {
              variant: 'failure',
            })
          }
          setIsPublishing(false)
          removeUpload(upload)
          setUploadId()
          setMetadataTx()
          setPublishingStepText('Create Post')
          setFormValues({ postForm: {} })
          setPostCreated(true)
          setOpen(false)
          setParentOpen(false)
        }
      }
    } catch (error) {
      console.warn(error)
    }
  }

  return (
    <Root>
      <CreateCtaButton
        variant="outlined"
        fullWidth
        onClick={() => setOpen(true)}
        disabled={!selectedHubId}
      > 
        <Typography>
        {preloadedRelease ? 'Create an editorial post about this release' : 'Publish a new post'}
        </Typography>
      </CreateCtaButton>
      <StyledModal
        aria-labelledby="transition-modal-title"
        aria-describedby="transition-modal-description"
        open={open}
        onClose={() => setOpen(false)}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: 500,
        }}
      >
        <Fade in={open}>
          <StyledPaper>
            <Grid item md={12}>
              {wallet?.connected && (
                <Box margin="auto">
                  <PostFormWrapper>
                    <HubPostCreateForm
                      onChange={handleFormChange}
                      values={formValues.postForm}
                      PostCreateSchema={PostCreateSchema}
                      update={update}
                      hubData={hubData}
                      postCreated={postCreated}
                      hubReleasesToReference={hubReleasesToReference}
                      preloadedRelease={preloadedRelease}
                    />
                  </PostFormWrapper>

                  <CreateCta>
                    {bundlrBalance === 0 && <BundlrModal inCreate={true} />}
                    {bundlrBalance > 0 && (
                      <Button
                        fullWidth
                        variant="outlined"
                        color="primary"
                        onClick={handleSubmit}
                        disabled={
                          isPublishing ||
                          !formIsValid ||
                          (!preloadedRelease && !canAddContent) ||
                          bundlrBalance === 0 ||
                          mbs < uploadSize
                        }
                        sx={{ height: '54px' }}
                      >
                        {isPublishing && <Dots msg={publishingStepText} />}
                        {!isPublishing && buttonText}
                      </Button>
                    )}

                    {pending && (
                      <LinearProgress
                        variant="determinate"
                        value={audioProgress || imageProgress}
                      />
                    )}

                    <Box display="flex" justifyContent="space-between">
                      {bundlrBalance > 0 && (
                        <BundlrBalanceInfo variant="subtitle1" align="left">
                          Bundlr Balance: {bundlrBalance?.toFixed(4)} SOL / $
                          {bundlrUsdBalance.toFixed(2)} / {mbs?.toFixed(2)} MB
                          ($
                          {(bundlrUsdBalance / mbs)?.toFixed(4)}/MB)
                        </BundlrBalanceInfo>
                      )}
                      {bundlrBalance === 0 && (
                        <BundlrBalanceInfo variant="subtitle1" align="left">
                          Please fund your Bundlr Account to enable publishing
                        </BundlrBalanceInfo>
                      )}
                      {uploadSize > 0 && (
                        <Typography variant="subtitle1" align="right">
                          Upload Size: {uploadSize} MB
                        </Typography>
                      )}
                    </Box>
                  </CreateCta>
                </Box>
              )}
            </Grid>
          </StyledPaper>
        </Fade>
      </StyledModal>
    </Root>
  )
}

const CreateCtaButton = styled(Button)(({theme}) => ({
  display: 'flex',
  ...theme.helpers.baseFont,
  marginTop: theme.spacing(1)
}))

const StyledPaper = styled(Paper)(({ theme }) => ({
  width: '50%',
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[5],
  padding: theme.spacing(2, 4),
  zIndex: '10',
}))

const PostFormWrapper = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '476px',
  margin: '24px auto',
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${theme.palette.grey.primary}`,
}))

const CreateCta = styled(Box)(({ theme }) => ({
  gridColumn: '1/3',
  width: '100%',
  position: 'relative',
  '& .MuiButton-root': {
    ...theme.helpers.baseFont,
  },
}))

const BundlrBalanceInfo = styled(Typography)(({ theme }) => ({
  whiteSpace: 'nowrap',
  margin: '5px 0',
}))

const Root = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
}))

const StyledModal = styled(Modal)(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}))

export default HubPostCreate