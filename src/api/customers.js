const API_BASE = '/api'

export async function getCustomers() {
  const response = await fetch(`${API_BASE}/customers`)
  if (!response.ok) throw new Error('Failed to fetch customers')
  return response.json()
}

export async function saveCustomer(data) {
  const response = await fetch(`${API_BASE}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) throw new Error('Failed to save customer')
  return response.json()
}

export async function deleteCustomer(id) {
  const response = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) throw new Error('Failed to delete customer')
  return response.json()
}
