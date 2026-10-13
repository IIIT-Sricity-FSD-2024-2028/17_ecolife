import { forwardRef } from 'react';
import './ui.css';

// forwardRef for the same reason as TextInput: react-hook-form's register()
// needs the ref to read the checkbox's checked state.
export const Checkbox = forwardRef(function Checkbox({ label, ...props }, ref) {
  return (
    <label className="checkbox">
      <input ref={ref} type="checkbox" className="checkbox__input" {...props} />
      <span className="checkbox__label">{label}</span>
    </label>
  );
});