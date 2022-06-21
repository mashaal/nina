import React, { useContext } from 'react'
import { styled } from '@mui/material/styles'
import nina from '@nina-protocol/nina-sdk'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { Typography, Box } from '@mui/material'


const HubTileView = (props) => {
  const { hubs } = props
  const router = useRouter()

  const handleClick = (handle) => {
    router.push({
      pathname: `/${handle}`,
    })
  }

  return (
    <Box>
      <TileGrid>
        {hubs.map((hub, i) => {
          return (
            <Tile key={i}>
              <HoverCard
                onClick={(e) => {
                  e.stopPropagation()
                  handleClick(hub.handle)
                }}
              >
                <CardCta
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClick(hub.handle)
                  }}
                >
                </CardCta>
                {hub.json.image && (
                  <Image
                    width={100}
                    height={100}
                    layout="responsive"
                    containerStyles={{
                      position: 'absolute',
                      left: '0',
                      top: '0',
                      zIndex: '1',
                    }}
                    src={hub.json.image}
                    priority={true}
                    unoptimized={true}
                    loading="eager"
                  />
                )}
              </HoverCard>
              <Box sx={{ padding: '10px 0 0' }}>
                <HubName>
                  {hub.json.displayName}
                </HubName>
              </Box>
            </Tile>
          )
        })}
      </TileGrid>
    </Box>
  )
}

const TileGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gridColumnGap: '30px',
  gridRowGap: '30px',
  maxWidth: '960px',
  margin: 'auto',
  [theme.breakpoints.down('md')]: {
    gridTemplateColumns: 'repeat(2, 1fr)',
    paddingBottom: '120px',
  },
}))

const Tile = styled(Box)(({ theme }) => ({
  textAlign: 'left',
  maxWidth: '100%',
  [theme.breakpoints.down('md')]: {
    maxWidth: '37vw',
  },
}))

const HoverCard = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  minHeight: '300px',
  [theme.breakpoints.down('md')]: {
    minHeight: '144px',
  },
}))

const CardCta = styled(Box)(({ theme }) => ({
  position: 'absolute',
  width: '100%',
  height: '100%',
  backgroundColor: theme.palette.overlay,
  zIndex: '2',
  opacity: '0',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  '&:hover': {
    opacity: '1',
    cursor: 'pointer',
  },
  [theme.breakpoints.down('md')]: {
    display: 'none',
    zIndex: '-1',
  },
}))

const HubName = styled(Typography)(() => ({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}))

export default HubTileView