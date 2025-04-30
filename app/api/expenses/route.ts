import { NextResponse } from 'next/server'
import { addExpense } from '@/lib/google-sheets'

export async function POST(request: Request) {
  try {
    const { amount, category } = await request.json()
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Spreadsheet ID not configured' },
        { status: 500 }
      )
    }

    const success = await addExpense(spreadsheetId, category, amount)
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to add expense' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding expense:', error)
    return NextResponse.json(
      { error: 'Failed to add expense' },
      { status: 500 }
    )
  }
} 