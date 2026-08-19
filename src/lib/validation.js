// Simple validation utilities. Each validator returns a string error message or null.

export const required = (value, fieldName = 'Este campo') => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return `${fieldName} es obligatorio`
  }
  return null
}

export const noSpaces = (value, fieldName = 'Este campo') => {
  if (typeof value === 'string' && value.includes(' ')) {
    return `${fieldName} no puede contener espacios`
  }
  return null
}

export const number = (value, fieldName = 'Este campo', { min = -Infinity, max = Infinity, allowEmpty = false } = {}) => {
  if (allowEmpty && (value === '' || value === null || value === undefined)) return null
  const num = parseFloat(value)
  if (Number.isNaN(num)) {
    return `${fieldName} debe ser un número válido`
  }
  if (num < min) {
    return `${fieldName} no puede ser menor a ${min}`
  }
  if (num > max) {
    return `${fieldName} no puede ser mayor a ${max}`
  }
  return null
}

export const integer = (value, fieldName = 'Este campo', { min = -Infinity, max = Infinity, allowEmpty = false } = {}) => {
  if (allowEmpty && (value === '' || value === null || value === undefined)) return null
  const num = parseInt(value, 10)
  if (Number.isNaN(num)) {
    return `${fieldName} debe ser un número entero`
  }
  if (num < min) {
    return `${fieldName} no puede ser menor a ${min}`
  }
  if (num > max) {
    return `${fieldName} no puede ser mayor a ${max}`
  }
  return null
}

export const unique = (value, fieldName = 'Este campo', existingValues = [], excludeValue = null) => {
  const normalized = String(value).trim().toUpperCase()
  const found = existingValues.some((v) => {
    const other = String(v).trim().toUpperCase()
    return other === normalized && other !== String(excludeValue || '').trim().toUpperCase()
  })
  if (found) {
    return `${fieldName} ya está en uso`
  }
  return null
}

export const minLength = (value, fieldName = 'Este campo', min = 1) => {
  if (typeof value === 'string' && value.trim().length < min) {
    return `${fieldName} debe tener al menos ${min} caracteres`
  }
  return null
}

export const email = (value, fieldName = 'Correo electrónico') => {
  if (!value) return null
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!regex.test(String(value))) {
    return `${fieldName} no es válido`
  }
  return null
}

export const oneOf = (value, fieldName = 'Este campo', allowed = []) => {
  if (!allowed.includes(value)) {
    return `${fieldName} no es válido`
  }
  return null
}

// Run a list of validators and return the first error or null
export const run = (value, validators) => {
  for (const validator of validators) {
    const error = validator(value)
    if (error) return error
  }
  return null
}

// Helper to build an errors object from a schema
// schema = { fieldName: (value) => errorOrNull }
export const validateSchema = (schema) => {
  const errors = {}
  let hasError = false
  Object.entries(schema).forEach(([key, validator]) => {
    const error = validator()
    if (error) {
      errors[key] = error
      hasError = true
    }
  })
  return { errors, hasError }
}
