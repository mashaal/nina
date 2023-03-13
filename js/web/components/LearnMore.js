import React from 'react'
import { styled } from '@mui/material/styles'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import NinaBox from '@nina-protocol/nina-internal-sdk/esm/NinaBox'
import Image from 'next/image'
import { imageManager } from '@nina-protocol/nina-internal-sdk/esm/utils'
import Link from 'next/link'
import ScrollablePageWrapper from './ScrollablePageWrapper'
const { loader } = imageManager
const LearnMore = () => {
  const examples = [
    {
      header: 'Limited Editions',
      body: 'Release a limited quantity of your release. You can set the number of editions you want to release when publishing.',
      image: '/images/LimitedEdition.png',
      link: 'https://ninaprotocol.com/Hy42kGTy6HqJgTkBcvb8YoUjgwP46TLqbpz9nWHSHomM',
      linkText: 'Surgeon, Jet Pack Mack',
    },
    {
      header: 'Open Editions',
      body: 'Create an unlimited supply of your release. You can close the sale at any time and your release will be sold out.',
      image: '/images/OpenEdition.png',
      link: 'https://ninaprotocol.com/8etCo8Gso93PLLjZeXWubjdm4Qd5NqLGL8qtHm76x5cN',
      linkText: 'Dasychira, Banyan Tree',
    },
    {
      header: 'Closed Editions',
      body: `Close the sale of your release at any time (possible for limited and open editions). The release will then be sold out, but it can still be sold on the secondary market.`,
      image: '/images/ClosedEdition.png',
      link: 'https://ninaprotocol.com/7oR7ETJW9QYXWm25mgLjP4kTRmjPGgQsH4HP1uwDGyKW',
      linkText: 'dBridge, Private Skies',
    },
    {
      header: 'Gates',
      body: `Include additional material only available to fans who purchase your release—lossless files, bonus tracks, videos, PDFs, etc.`,
      image: '/images/Gates.png',
      link: 'https://ninaprotocol.com/2QfDZcQnT51mQTFrWfzKTPPDrB7G3rk5fSif1WTA7Dqd',
      linkText: 'gantz, evoker',
    },
    {
      header: 'Editorial',
      body: `Share additional context around your releases or make blog posts to share updates, stories, and musings with your community.`,
      image: '/images/Posts.png',
      link: `https://hubs.ninaprotocol.com/ledisko/posts/8BEauXrASkugBm6gR4wkH3T5RU5JAuwLwybkfbF1Pg7W`,
      linkText: `Gesloten Cirkel, Detoon`,
    },
  ]

  const faqs = [
    {
      question: 'What can I release on Nina?',
      answer:
        'Anything. Tracks, live sets, demos, b-sides, podcasts, recordings of your fireplace, etc',
    },
    {
      question: 'Do my releases on Nina need to be exclusive?',
      answer:
        'No. You can release your music anywhere else, Nina is another home for your music, like Bandcamp and SoundCloud. Open Editions are an easy way to release music that is available elsewhere.',
    },
    {
      question: 'Do I have to pay to start using Nina?',
      answer:
        'No. We also cover costs for artists and label to get set up, helping you get storage space and bandwidth for your releases.',
    },
    {
      question: 'How are releases on Nina priced?',
      answer:
        'You can set whatever price you want when you publish your release. Most releases you will find Nina are $1-5, but some artists have found success with higher prices (see Joanna7459). Artists on Nina receive 100% of their sales.',
    },
    {
      question: 'Can I make my releases free?',
      answer: 'Yes. Just set the price to 0 when you publish.',
    },
    {
      question: 'Why is Nina built on the blockchain?',
      answer: `Nina utilizes the blockchain to allow artists to have the most control over their work. Publishing music on-chain allows artists to side-step platform fees and keep 100% of their sales. The technology enables easy revenue split automation, royalties on resales, shared pages with collaborators, and permanent web archiving via hosting on Arweave. We know a lot of artists are rightfully skeptical about anything blockchain-related, so we try to help them get comfortable with our tools so they can decide whether it's for them or not.`,
    },
    {
      question: 'How do you buy music on Nina?',
      answer: `You need a Solana wallet (we recommend Phantom) funded with SOL or USDC to purchase music on Nina. To fund a wallet, you can either purchase SOL with a credit card from inside the Phantom waller, or you can buy SOL on an exchange like Coinbase and send it to your Phantom wallet.`,
    },
  ]

  return (
    <ScrollablePageWrapper>
      <StyledGrid>
        <LearnMoreWrapper>
          <Box mb={2}>
            <Typography variant="h1">
              {`Nina is an independent music ecosystem that offers artists new models
          for releasing music. Below you can learn more about how it works and
          see a list of FAQs.`}
            </Typography>
          </Box>
          <Box mt={2} mb={2}>
            <Typography variant="h2">{`How you can use Nina:`}</Typography>
            {examples.map((example, index) => (
              <ExampleContainer key={index}>
                <ExampleHeader variant="h1">{example.header}</ExampleHeader>
                <ExampleBody variant="h4">{example.body}</ExampleBody>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Link href={example.link}>
                    <a target="_blank">{example.linkText}</a>
                  </Link>
                  <Link href={example.link}>
                    <a target="_blank">
                      <img
                        layout="responsive"
                        src={example.image}
                        alt={example.linkText}
                        style={{
                          width: '75%',
                          height: 'auto',
                        }}
                      />
                    </a>
                  </Link>
                </Box>
              </ExampleContainer>
            ))}
          </Box>
          {/* FAQ */}
          <Box mt={2} mb={2}>
            <Typography variant="h1">{`FAQ`}</Typography>
            {faqs.map((faq, index) => (
              <FAQBox key={index}>
                <Typography variant="h3">{faq.question}</Typography>
                <Typography variant="" sx={{ width: '50%' }}>
                  {faq.answer}
                </Typography>
              </FAQBox>
            ))}
          </Box>
        </LearnMoreWrapper>
      </StyledGrid>
    </ScrollablePageWrapper>
  )
}

const StyledGrid = styled(Grid)(({ theme }) => ({
  paddingTop: '20px',
  maxHeight: '90vh',
  overflowY: 'scroll',
  justifyContent: 'center',
  alignItems: 'center',
  '& a': {
    textDecoration: 'none',
    color: theme.palette.blue,
    '&:hover': {
      opacity: '85%',
    },
  },
}))

const LearnMoreWrapper = styled(Box)(() => ({
  width: '100%',
  margin: '100px auto ',
  display: 'flex',
  flexDirection: 'column',
  gridColumn: '1/3',
  maxWidth: '1000px',
  textAlign: 'left',
}))

const FAQBox = styled(Box)(() => ({
  width: '50%',
  marginTop: '15px',
  marginBottom: '15px',
}))

const ExampleHeader = styled(Typography)(() => ({
  marginTop: '30px',
}))

const ExampleBody = styled(Typography)(() => ({
  marginTop: '15px',
  marginBottom: '30px',
  width: '50%',
}))

const ExampleContainer = styled(Box)(() => ({
  marginBottom: '30px',
}))

export default LearnMore