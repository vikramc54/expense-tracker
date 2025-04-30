import { google, sheets_v4 } from 'googleapis'

const sheets = google.sheets('v4')

export async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  return auth
}

export async function getCategories(spreadsheetId: string) {
  const auth = await getAuthClient()
  const currentMonth = new Date().toLocaleString('default', { month: 'long' })
  
  try {
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: `${currentMonth}!B:B`,
    })

    const values = response.data.values || []
    // Filter out "Category" and any empty values
    return Array.from(new Set(values.flat()))
      .filter(Boolean)
      .filter(category => category !== 'Category')
  } catch (error) {
    console.error('Error fetching categories:', error)
    return []
  }
}

export async function addExpense(
  spreadsheetId: string,
  category: string,
  amount: number
) {
  const auth = await getAuthClient()
  const currentMonth = new Date().toLocaleString('default', { month: 'long' })
  // Get current time in IST
  const timestamp = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  try {
    // Check if sheet exists
    const sheetsResponse = await sheets.spreadsheets.get({
      auth,
      spreadsheetId,
    })

    const sheetExists = sheetsResponse.data.sheets?.some(
      (sheet) => sheet.properties?.title === currentMonth
    )

    if (!sheetExists) {
      // Create new sheet
      const addSheetResponse = await sheets.spreadsheets.batchUpdate({
        auth,
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: currentMonth,
                },
              },
            },
          ],
        },
      })

      const newSheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId

      if (!newSheetId) {
        throw new Error('Failed to get new sheet ID')
      }

      // Add headers
      await sheets.spreadsheets.values.update({
        auth,
        spreadsheetId,
        range: `${currentMonth}!A1:C1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['Timestamp', 'Category', 'Amount']],
        },
      })

      // Format the sheet
      await sheets.spreadsheets.batchUpdate({
        auth,
        spreadsheetId,
        requestBody: {
          requests: [
            // Format header row
            {
              repeatCell: {
                range: {
                  sheetId: newSheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 3,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.8, green: 0.8, blue: 0.8 },
                    textFormat: { bold: true },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
              },
            },
            // Format amount column as Indian Rupee
            {
              repeatCell: {
                range: {
                  sheetId: newSheetId,
                  startRowIndex: 1,
                  startColumnIndex: 2,
                  endColumnIndex: 3,
                },
                cell: {
                  userEnteredFormat: {
                    numberFormat: {
                      type: 'CURRENCY',
                      pattern: '₹#,##0.00',
                    },
                  },
                },
                fields: 'userEnteredFormat.numberFormat',
              },
            },
            // Format timestamp column
            {
              repeatCell: {
                range: {
                  sheetId: newSheetId,
                  startRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    numberFormat: {
                      type: 'DATE_TIME',
                      pattern: 'dd/mm/yyyy hh:mm:ss',
                    },
                  },
                },
                fields: 'userEnteredFormat.numberFormat',
              },
            },
            // Auto-resize columns
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: newSheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 3,
                },
              },
            },
          ],
        },
      })
    }

    // Add new expense
    await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId,
      range: `${currentMonth}!A:C`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[timestamp, category, amount]],
      },
    })

    // Get the sheet ID for auto-resize
    const sheetResponse = await sheets.spreadsheets.get({
      auth,
      spreadsheetId,
    })
    const sheetId = sheetResponse.data.sheets?.find(s => s.properties?.title === currentMonth)?.properties?.sheetId

    if (sheetId) {
      // Get the actual data range
      const dataResponse = await sheets.spreadsheets.values.get({
        auth: await getAuthClient(),
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `${currentMonth}!A:C`
      })

      const values = dataResponse.data.values || []
      const lastRowIndex = values.length

      // Get existing charts
      const chartsResponse = await sheets.spreadsheets.get({
        auth,
        spreadsheetId,
        ranges: [`${currentMonth}!A:Z`],
        includeGridData: false
      })

      const charts = chartsResponse.data.sheets?.[0]?.charts || []
      const existingChart = charts.find(chart => 
        chart.spec?.title === 'Expenses by Category' && 
        chart.position?.overlayPosition?.anchorCell?.columnIndex === 7
      )

      const chartRequests: sheets_v4.Schema$Request[] = []

      if (existingChart) {
        // Update existing chart
        chartRequests.push({
          updateChartSpec: {
            chartId: existingChart.chartId!,
            spec: {
              title: 'Expenses by Category',
              basicChart: {
                chartType: 'COLUMN',
                legendPosition: 'BOTTOM_LEGEND',
                domains: [{
                  domain: {
                    sourceRange: {
                      sources: [{
                        sheetId: sheetId,
                        startRowIndex: 1,
                        endRowIndex: lastRowIndex,
                        startColumnIndex: 21,
                        endColumnIndex: 22
                      }]
                    }
                  }
                }],
                series: [{
                  series: {
                    sourceRange: {
                      sources: [{
                        sheetId: sheetId,
                        startRowIndex: 1,
                        endRowIndex: lastRowIndex,
                        startColumnIndex: 22,
                        endColumnIndex: 23
                      }]
                    }
                  },
                  targetAxis: 'LEFT_AXIS'
                }],
                headerCount: 0
              }
            }
          }
        })
      } else {
        // Create new chart
        chartRequests.push({
          addChart: {
            chart: {
              spec: {
                title: 'Expenses by Category',
                basicChart: {
                  chartType: 'COLUMN',
                  legendPosition: 'BOTTOM_LEGEND',
                  domains: [{
                    domain: {
                      sourceRange: {
                        sources: [{
                          sheetId: sheetId,
                          startRowIndex: 1,
                          endRowIndex: lastRowIndex,
                          startColumnIndex: 21,
                          endColumnIndex: 22
                        }]
                      }
                    }
                  }],
                  series: [{
                    series: {
                      sourceRange: {
                        sources: [{
                          sheetId: sheetId,
                          startRowIndex: 1,
                          endRowIndex: lastRowIndex,
                          startColumnIndex: 22,
                          endColumnIndex: 23
                        }]
                      }
                    },
                    targetAxis: 'LEFT_AXIS'
                  }],
                  headerCount: 0
                }
              },
              position: {
                overlayPosition: {
                  anchorCell: {
                    sheetId: sheetId,
                    rowIndex: 0,
                    columnIndex: 7
                  },
                  offsetXPixels: 0,
                  offsetYPixels: 0,
                  widthPixels: 800,
                  heightPixels: 600
                }
              }
            }
          }
        })
      }

      // Auto-resize columns after adding new expense
      await sheets.spreadsheets.batchUpdate({
        auth,
        spreadsheetId,
        requestBody: {
          requests: [
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 4
                },
              },
            },
            // Set specific widths for each column
            {
              updateDimensionProperties: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 1
                },
                properties: {
                  pixelSize: 180 // Wider for timestamp
                },
                fields: 'pixelSize'
              }
            },
            {
              updateDimensionProperties: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 1,
                  endIndex: 2
                },
                properties: {
                  pixelSize: 120 // Medium for category
                },
                fields: 'pixelSize'
              }
            },
            {
              updateDimensionProperties: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 2,
                  endIndex: 3
                },
                properties: {
                  pixelSize: 100 // Narrower for amount
                },
                fields: 'pixelSize'
              }
            },
            // Format timestamp to show local time
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 1, // Start from row 2 (after header)
                  startColumnIndex: 0,
                  endColumnIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    numberFormat: {
                      type: 'DATE_TIME',
                    },
                  },
                },
                fields: 'userEnteredFormat.numberFormat',
              },
            },
          ],
        },
      })

      // Add formatting, pivot table, and charts
      const requests: sheets_v4.Schema$Request[] = [
        // Format header row
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                textFormat: { bold: true },
                horizontalAlignment: 'CENTER'
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
          }
        },
        // Format amount column as Indian Rupee
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startColumnIndex: 2,
              endColumnIndex: 3
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: 'CURRENCY',
                  pattern: '₹#,##0.00'
                }
              }
            },
            fields: 'userEnteredFormat.numberFormat'
          }
        },
        // Format timestamp column as date/time
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startColumnIndex: 3,
              endColumnIndex: 4
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: 'DATE_TIME',
                  pattern: 'dd/mm/yyyy hh:mm:ss'
                }
              }
            },
            fields: 'userEnteredFormat.numberFormat'
          }
        },
        // Create pivot table with grand total
        {
          updateCells: {
            rows: [{
              values: [{
                pivotTable: {
                  source: {
                    sheetId: sheetId,
                    startRowIndex: 0,
                    endRowIndex: lastRowIndex,
                    startColumnIndex: 0,
                    endColumnIndex: 4
                  },
                  rows: [{
                    sourceColumnOffset: 1, // Category column
                    showTotals: true,
                    sortOrder: 'ASCENDING'
                  }],
                  values: [{
                    summarizeFunction: 'SUM',
                    sourceColumnOffset: 2, // Amount column
                    name: 'Total Amount'
                  }],
                  valueLayout: 'HORIZONTAL'
                }
              }]
            }],
            start: {
              sheetId: sheetId,
              rowIndex: 0,
              columnIndex: 4 // Moved one column left
            },
            fields: 'pivotTable'
          }
        },
        // Create pivot table for chart (without grand total)
        {
          updateCells: {
            rows: [{
              values: [{
                pivotTable: {
                  source: {
                    sheetId: sheetId,
                    startRowIndex: 0,
                    endRowIndex: lastRowIndex,
                    startColumnIndex: 0,
                    endColumnIndex: 4
                  },
                  rows: [{
                    sourceColumnOffset: 1, // Category column
                    showTotals: false, // No grand total
                    sortOrder: 'ASCENDING'
                  }],
                  values: [{
                    summarizeFunction: 'SUM',
                    sourceColumnOffset: 2, // Amount column
                    name: 'Total Amount'
                  }],
                  valueLayout: 'HORIZONTAL'
                }
              }]
            }],
            start: {
              sheetId: sheetId,
              rowIndex: 0,
              columnIndex: 21 // Keep in column V
            },
            fields: 'pivotTable'
          }
        },
        ...chartRequests
      ]

      await sheets.spreadsheets.batchUpdate({
        auth: await getAuthClient(),
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        requestBody: { requests }
      })
    }

    return true
  } catch (error) {
    console.error('Error adding expense:', error)
    return false
  }
} 