'use client'

import { signIn } from 'next-auth/react'
import { Button, Container, Typography, Box } from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'

export default function SignIn() {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h4" sx={{ mb: 4 }}>
          Expense Tracker
        </Typography>
        <Button
          variant="contained"
          startIcon={<GoogleIcon />}
          onClick={() => signIn('google', { callbackUrl: '/' })}
          sx={{ mt: 2 }}
        >
          Sign in with Google
        </Button>
      </Box>
    </Container>
  )
} 