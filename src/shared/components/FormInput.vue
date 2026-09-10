<script setup>
import FormLabel from './FormLabel.vue'

defineProps({
  id:           { type: String, required: true },
  label:        { type: String, required: true },
  modelValue:   { type: String, default: '' },
  type:         { type: String, default: 'text' },
  placeholder:  { type: String, default: '' },
  icon:         { type: String, default: '' },
  autocomplete: { type: String, default: undefined },
  min:          { type: String, default: undefined },
  max:          { type: String, default: undefined },
  step:         { type: String, default: undefined },
  inputmode:    { type: String, default: undefined },
  ariaDescribedby: { type: String, default: undefined },
  ariaInvalid:  { type: [Boolean, String], default: undefined },
})

defineEmits(['update:modelValue', 'invalid'])
</script>

<template>
  <section>
    <FormLabel :input-id="id">
      {{ label }}
    </FormLabel>

    <div class="relative">
      <input
        :id="id"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :min="min"
        :max="max"
        :step="step"
        :inputmode="inputmode"
        :aria-describedby="ariaDescribedby"
        :aria-invalid="ariaInvalid"
        class="form-input"
        :class="{ 'form-input--with-icon': icon }"
        @input="$emit('update:modelValue', $event.target.value)"
        @invalid="$emit('invalid', $event)"
      >

      <span
        v-if="icon"
        class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[20px] pointer-events-none"
        aria-hidden="true"
      >{{ icon }}</span>
    </div>
  </section>
</template>

<style scoped>
.form-input {
  display: block;
  width: 100%;
  min-width: 0;
  height: 47px;
  padding: 0 12px;
  color: #073f38;
  border: 1px solid #a9c9c3;
  border-radius: 10px;
  outline: 0;
  background: #fff;
  box-shadow: 0 1px 0 rgba(0, 79, 69, 0.02);
  font-family: 'Noto Sans Thai', system-ui, sans-serif;
  font-size: 14px;
  transition: border-color 150ms, box-shadow 150ms;
}

/* iOS Safari sizes a native date control from its shadow DOM, and `min-width: 0`
   on the input cannot shrink that: two date fields in a two-column row measured
   ~199pt each against 390pt of panel, so the row overflowed and the second field's
   border was clipped. `appearance: none` drops the intrinsic minimum. It also drops
   the native vertical centring, hence the explicit line-height -- 45px is the 47px
   control minus its two 1px borders. */
.form-input[type='date'] {
  appearance: none;
  -webkit-appearance: none;
}

.form-input[type='date']::-webkit-date-and-time-value {
  margin: 0;
  text-align: left;
  line-height: 45px;
}

.form-input--with-icon {
  padding-right: 44px;
}

.form-input::placeholder {
  color: #5f7772;
}

.form-input:focus {
  border-color: #007a69;
  box-shadow: 0 0 0 3px rgba(0, 122, 105, 0.14);
}
</style>
