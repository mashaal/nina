import React, { useState, useContext, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import nina from '@nina-protocol/nina-sdk'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import { useRouter } from 'next/router'
import Image from 'next/image'
import Typography from '@mui/material/Typography'
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos'
const ReleasePurchase = dynamic(() => import('./ReleasePurchase'))
const { HubContext, ReleaseContext, AudioPlayerContext } = nina.contexts

const Release = ({ metadataSsr, releasePubkey, hubPubkey }) => {
  const router = useRouter()
  const { updateTrack, track, isPlaying } = useContext(AudioPlayerContext)
  const { releaseState, getRelease } = useContext(ReleaseContext)
  const { getHub, hubState } = useContext(HubContext)

  const [metadata, setMetadata] = useState(metadataSsr || null)

  useEffect(() => {
    if (releasePubkey) {
      getRelease(releasePubkey)
    }
  }, [releasePubkey])

  useEffect(() => {
    if (hubPubkey && !hubState[hubPubkey]) {
      getHub(hubPubkey)
    }
  }, [hubPubkey, getHub])

  useEffect(() => {
    if (releaseState.metadata[releasePubkey] && !metadata) {
      setMetadata(releaseState.metadata[releasePubkey])
    }
  }, [releaseState, metadata, releasePubkey])

  return (
    <>
      <BackButton onClick={() => router.back()} />
      <Grid
        item
        md={6}
        xs={12}
        sx={{
          // margin: {md: '50px auto auto', xs: '0px'},
          margin: { md: '0px auto auto', xs: '0px' },
          padding: '0 15px',
        }}
      >
        {metadata && (
          <>
            <MobileImageWrapper>
              <Image
                src={metadata?.image}
                layout="responsive"
                objectFit="contain"
                objectPosition={'center'}
                height={100}
                width={100}
                alt={metadata.description || 'album art'}
              />
            </MobileImageWrapper>
            <Typography
              variant="h3"
              align="left"
              sx={{ color: 'text.primary' }}
            >
              {metadata.properties.artist} - {metadata.properties.title} (
              <PlayButton
                onClick={(e) => {
                  e.stopPropagation()
                  updateTrack(
                    releasePubkey,
                    !(isPlaying && track.releasePubkey === releasePubkey)
                  )
                }}
              >
                {isPlaying && track.releasePubkey === releasePubkey
                  ? 'Pause'
                  : 'Play'}
              </PlayButton>
              )
            </Typography>
            <StyledDescription variant="h4" align="left">
              {metadata.description}
            </StyledDescription>
          </>
        )}
        <Box sx={{ marginTop: '100px' }}>
          <ReleasePurchase releasePubkey={releasePubkey} metadata={metadata} />
        </Box>
      </Grid>

      <DesktopImageGridItem item md={6}>
        {metadata && (
          <ImageContainer>
            <Image
              src={metadata?.image}
              layout="responsive"
              objectFit="contain"
              height="100"
              width="100"
              objectPosition={'right bottom'}
              alt={metadata.description || 'album art'}
            />
          </ImageContainer>
        )}
      </DesktopImageGridItem>
    </>
  )
}

const PlayButton = styled(Button)(({ theme }) => ({
  fontSize: theme.typography.body1.fontSize,
  padding: '0 10px',
  color: `${theme.palette.text.primary} !important`,
  ':disabled': {
    color: theme.palette.text.primary + 'a0',
  },
  '&:hover': {
    opacity: '50%',
    backgroundColor: `${theme.palette.transparent} !important`,
  },
}))

const StyledDescription = styled(Typography)(({ theme }) => ({
  overflowWrap: 'anywhere',
  [theme.breakpoints.up('md')]: {
    maxHeight: '225px',
    overflowY: 'scroll',
  },
}))

const DesktopImageGridItem = styled(Grid)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-end',
  [theme.breakpoints.down('md')]: {
    display: 'none',
  },
}))

const MobileImageWrapper = styled(Grid)(({ theme }) => ({
  display: 'none',
  [theme.breakpoints.down('md')]: {
    display: 'block',
    padding: '30px 0 0',
  },
}))

const ImageContainer = styled(Box)(() => ({
  width: '100%',
}))

const BackButton = styled(ArrowBackIosIcon)(({ theme }) => ({
  width: '30px',
  height: '30px',
  position: 'absolute',
  zIndex: '1000000',
  top: '15px',
  left: '15px',
  [theme.breakpoints.up('md')]: {
    display: 'none',
  },
}))

export default Release