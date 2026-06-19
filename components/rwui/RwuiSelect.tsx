"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import "@/styles/rwui-select.css"

interface SelectDataItem {
  label: string
  value: string
  icon?: React.ReactNode
}

interface RwuiSelectProps {
  data: SelectDataItem[]
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  trigger?: React.ReactNode
  tooltip?: string
  backdropBlur?: boolean
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}

export function RwuiSelect({
  data,
  defaultValue,
  value: controlledValue,
  onChange,
  trigger,
  tooltip,
  backdropBlur = false,
  disabled = false,
  className = "",
  style,
}: RwuiSelectProps) {
  const [internalValue, setInternalValue] = useState("")
  const [isOpen, setOpen] = useState(false)
  const [ilabel, setILabel] = useState("Select")
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; reverse: boolean }>({ top: 0, left: 0, width: 0, reverse: false })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue

  useEffect(() => {
    if (data.length === 0) return

    if (defaultValue) {
      const item = data.find((x) => x.value === defaultValue)
      if (item) {
        setInternalValue(defaultValue)
        setILabel(item.label)
      }
    } else if (!controlledValue) {
      setILabel(data[0].label)
      setInternalValue(data[0].value)
    }
  }, [data, defaultValue, controlledValue])

  useEffect(() => {
    if (controlledValue !== undefined) {
      const item = data.find((x) => x.value === controlledValue)
      if (item) {
        setILabel(item.label)
      }
    }
  }, [controlledValue, data])

  const handleItemClick = useCallback(
    (value: string, label: string) => {
      if (controlledValue === undefined) {
        setInternalValue(value)
      }
      setILabel(label)
      setOpen(false)
      onChange?.(value)
    },
    [controlledValue, onChange]
  )

  const updateDropdownPos = useCallback(() => {
    const el = triggerRef.current || wrapperRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const isReverse = rect.top > window.innerHeight / 2
    setDropdownPos({
      top: isReverse ? rect.top - 8 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      reverse: isReverse,
    })
  }, [])

  const toggleDropdown = useCallback(() => {
    if (disabled) return
    setOpen((prev) => {
      if (!prev) {
        updateDropdownPos()
      }
      return !prev
    })
  }, [disabled, updateDropdownPos])

  // Update position on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return
    const handleUpdate = () => updateDropdownPos()
    window.addEventListener("scroll", handleUpdate, true)
    window.addEventListener("resize", handleUpdate)
    return () => {
      window.removeEventListener("scroll", handleUpdate, true)
      window.removeEventListener("resize", handleUpdate)
    }
  }, [isOpen, updateDropdownPos])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        // Also check if click is inside the portal dropdown
        const dropdown = document.getElementById("rwui-select-dropdown")
        if (dropdown && !dropdown.contains(target)) {
          setOpen(false)
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const dropdownContent = isOpen ? (
    <div
      id="rwui-select-dropdown"
      className="rwui-scope"
      data-theme={document.documentElement.getAttribute("data-theme")}
      style={{
        position: "fixed",
        top: dropdownPos.reverse ? undefined : dropdownPos.top,
        bottom: dropdownPos.reverse ? window.innerHeight - dropdownPos.top : undefined,
        left: dropdownPos.left,
        minWidth: dropdownPos.width,
        zIndex: 99999,
      }}
    >
      <ul
        className={`ui-menu-list ui-dropdown-ul-default show${dropdownPos.reverse ? " reverse" : ""}${backdropBlur ? " ui-backdrop-blur" : ""}`}
      >
        {data.map((item, index) => (
          <li
            key={index}
            className={`ui-menu-list-item${item.value === currentValue ? " selected" : ""}`}
            onClick={(e) => {
              e.stopPropagation()
              handleItemClick(item.value, item.label)
            }}
          >
            <span>
              {item.icon}
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  ) : null

  return (
    <>
      <div className="rwui-scope" data-theme={document.documentElement.getAttribute("data-theme")}>
        <div
          ref={wrapperRef}
          onClick={toggleDropdown}
          className={`ui-menu-select ${disabled ? "disabled" : ""} ${className}`}
          style={style}
        >
          {trigger ? (
            <>{trigger}</>
          ) : (
            <span ref={triggerRef} className="ui-menu-title input-btn-default" title={tooltip}>
              {ilabel}
            </span>
          )}
        </div>
      </div>
      {typeof document !== "undefined" && createPortal(dropdownContent, document.body)}
    </>
  )
}

interface RwuiSelectNativeProps {
  data: SelectDataItem[]
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  name?: string
  tooltip?: string
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}

export function RwuiSelectNative({
  data,
  defaultValue,
  value: controlledValue,
  onChange,
  name,
  tooltip,
  disabled = false,
  className = "",
  style,
}: RwuiSelectNativeProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange?.(e.target.value)
  }

  return (
    <div className="rwui-scope" data-theme={document.documentElement.getAttribute("data-theme")}>
      <div className={`ui-select-menu ${className}`} style={style}>
        <select
          className="input-btn-default"
          name={name}
          title={tooltip}
          disabled={disabled}
          value={controlledValue}
          defaultValue={defaultValue}
          onChange={handleChange}
        >
          {data.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}