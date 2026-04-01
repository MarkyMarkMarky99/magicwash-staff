import { reactive, ref } from 'vue'

export function useForm(initialData = {}) {
  const formData = reactive({ ...initialData })
  const errors = ref({})

  const updateField = (field, value) => {
    formData[field] = value
  }

  const resetForm = () => {
    // Cannot just reassign the reactive proxy, so we delete and re-add keys
    for (const key in formData) {
      delete formData[key]
    }
    Object.assign(formData, initialData)
    errors.value = {}
  }

  const setFormData = (data) => {
    for (const key in formData) {
      delete formData[key]
    }
    Object.assign(formData, data)
    errors.value = {}
  }

  return { formData, errors, updateField, resetForm, setFormData }
}
