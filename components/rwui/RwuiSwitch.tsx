"use client"

import React, { forwardRef } from "react"

interface RwuiSwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  tooltip?: string
  label?: boolean
  labelOn?: string
  labelOff?: string
  labelPosition?: "start" | "end"
  labelFixedWidth?: number | string
  className?: string
}

export const RwuiSwitch = forwardRef<HTMLInputElement, RwuiSwitchProps>(
  (
    {
      checked,
      defaultChecked,
      onChange,
      disabled,
      tooltip,
      label = false,
      labelOn = "On",
      labelOff = "Off",
      labelPosition = "end",
      labelFixedWidth,
      className = "",
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.checked)
    }

    return (
      <label className={`ui-switch-container ${className}`} title={tooltip}>
        {label && labelPosition === "start" && (
          <span
            className="ui-switch-label"
            data-on={labelOn}
            data-off={labelOff}
            style={{ width: labelFixedWidth }}
          />
        )}

        <input
          ref={ref}
          type="checkbox"
          className="ui-switch"
          disabled={disabled}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={handleChange}
        />

        {label && labelPosition === "end" && (
          <span
            className="ui-switch-label"
            data-on={labelOn}
            data-off={labelOff}
            style={{ width: labelFixedWidth }}
          />
        )}
      </label>
    )
  }
)

RwuiSwitch.displayName = "RwuiSwitch"