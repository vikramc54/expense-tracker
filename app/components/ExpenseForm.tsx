'use client'

import { useState, useEffect } from 'react'
import {
  TextField,
  Button,
  Autocomplete,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material'
import { useSession } from 'next-auth/react'

export default function ExpenseForm() {
  const { data: session } = useSession()
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [isNewCategory, setIsNewCategory] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      const data = await response.json()
      setCategories(data)
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          category: isNewCategory ? category : categories.find(c => c === category),
        }),
      })

      if (response.ok) {
        setAmount('')
        setCategory('')
        setIsNewCategory(false)
        setMessage('Expense added successfully!')
        fetchCategories()
      } else {
        setMessage('Error adding expense. Please try again.')
      }
    } catch (error) {
      setMessage('Error adding expense. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Add New Expense
      </Typography>

      <TextField
        fullWidth
        label="Amount (₹)"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        sx={{ mb: 2 }}
        inputProps={{ step: '0.01' }}
      />

      {!isNewCategory ? (
        <Autocomplete
          options={categories}
          value={category}
          onChange={(_, newValue) => setCategory(newValue || '')}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Category"
              required
              sx={{ mb: 2 }}
            />
          )}
        />
      ) : (
        <TextField
          fullWidth
          label="New Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          sx={{ mb: 2 }}
        />
      )}

      <Button
        variant="outlined"
        onClick={() => setIsNewCategory(!isNewCategory)}
        sx={{ mb: 2 }}
      >
        {isNewCategory ? 'Select Existing Category' : 'Add New Category'}
      </Button>

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={isLoading}
      >
        {isLoading ? <CircularProgress size={24} /> : 'Add Expense'}
      </Button>

      {message && (
        <Typography
          color={message.includes('Error') ? 'error' : 'success'}
          sx={{ mt: 2 }}
        >
          {message}
        </Typography>
      )}
    </Box>
  )
} 