"use client"

import React, { forwardRef, useRef, useCallback, useState, useEffect, useImperativeHandle } from "react"
import "@/styles/rwui-slider.css"

interface RwuiSliderProps {
  value?: number
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  onChange?: (value: number) => void
  onDragEnd?: () => void
  onDragStart?: () => void
  showPopupValue?: boolean
  width?: number | string
  tooltip?: string
  disabled?: boolean
  className?: string
}

export const RwuiSlider = forwardRef<HTMLInputElement, RwuiSliderProps>(
  (
    {
      value: controlledValue,
      defaultValue = 0,
      min = 0,
      max = 100,
      step = 1,
      onChange,
      onDragEnd,
      onDragStart,
      showPopupValue = true,
      width,
      tooltip,
      disabled = false,
      className = "",
    },
    ref
  ) => {
    const popupRef = useRef<HTMLSpanElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const isDragging = useRef(false)
    const [displayValue, setDisplayValue] = useState(
      controlledValue !== undefined ? controlledValue : defaultValue
    )

    // Expose inputRef to parent
    useImperativeHandle(ref, () => inputRef.current!, [])

    // Sync displayValue when controlled value changes (only when not dragging)
    useEffect(() => {
      if (controlledValue !== undefined && !isDragging.current) {
        setDisplayValue(controlledValue)
      }
    }, [controlledValue])

    const toggleVisible = useCallback(() => {
      if (showPopupValue && popupRef.current) {
        popupRef.current.style.visibility = "visible"
        popupRef.current.style.opacity = "1"
      }
    }, [showPopupValue])

    const toggleHidden = useCallback(() => {
      if (showPopupValue && popupRef.current) {
        popupRef.current.style.visibility = "hidden"
        popupRef.current.style.opacity = "0"
      }
    }, [showPopupValue])

    const updateGradient = useCallback(
      (val: number) => {
        const ratio = max > min ? ((val - min) / (max - min)) * 100 : 0
        if (inputRef.current) {
          inputRef.current.style.background = `linear-gradient(90deg, var(--color-primary-adaptive) ${ratio}%, #999999 ${ratio}%)`
        }
        return ratio
      },
      [min, max]
    )

    const handlePointerDown = useCallback(
      () => {
        isDragging.current = true
        onDragStart?.()
        toggleVisible()
      },
      [onDragStart, toggleVisible]
    )

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = Number(e.target.value)
        setDisplayValue(newVal)
        updateGradient(newVal)
        toggleVisible()
        onChange?.(newVal)
      },
      [onChange, updateGradient, toggleVisible]
    )

    const handlePointerUp = useCallback(
      (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
        if (!isDragging.current) return
        isDragging.current = false
        const finalVal = Number((e.target as HTMLInputElement).value)
        setDisplayValue(finalVal)
        updateGradient(finalVal)
        onDragEnd?.()
      },
      [onDragEnd, updateGradient]
    )

    const handleMouseEnter = useCallback(() => {
      toggleVisible()
    }, [toggleVisible])

    const handleMouseLeave = useCallback(() => {
      if (!isDragging.current) {
        toggleHidden()
      }
    }, [toggleHidden])

    const ratio = max > min ? ((displayValue - min) / (max - min)) * 100 : 0

    return (
      <div
        className={`rwui-scope ${className}`}
        data-theme={document.documentElement.getAttribute("data-theme")}
      >
        <div
          title={tooltip}
          style={{ width }}
          className="ui-range-slider"
          data-win-orient="horizontal"
        >
          <input
            ref={inputRef}
            type="range"
            min={min}
            max={max}
            step={step}
            value={displayValue}
            disabled={disabled}
            onChange={handleChange}
            onMouseDown={handlePointerDown}
            onMouseUp={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchEnd={handlePointerUp}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              background: `linear-gradient(90deg, var(--color-primary-adaptive) ${ratio}%, #999999 ${ratio}%)`,
            }}
          />
          {showPopupValue && (
            <span
              ref={popupRef}
              className="ui-range-slider-popup"
              style={{ left: `${ratio * 0.72}%` }}
            >
              {displayValue}
            </span>
          )}
        </div>
      </div>
    )
  }
)

RwuiSlider.displayName = "RwuiSlider"