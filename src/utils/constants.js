export const APP_CONFIG = {
  APPOINTMENTS_SPREADSHEET_ID: import.meta.env.VITE_APPOINTMENTS_SPREADSHEET_ID,
  CUSTOMERS_SPREADSHEET_ID:    import.meta.env.VITE_CUSTOMERS_SPREADSHEET_ID,
  APPOINTMENTS_SCRIPT_URL:     import.meta.env.VITE_APPOINTMENTS_SCRIPT_URL,
}

export const ICON_MAP = {
  PICKUP:          'local_laundry_service',
  DELIVERY:        'checkroom',
  PICKUP_DELIVERY: 'dry_cleaning',
}
