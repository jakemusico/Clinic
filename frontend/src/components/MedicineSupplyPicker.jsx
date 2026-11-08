import { useEffect, useState, useMemo } from 'react'
import { inventoryApi } from '../api/inventory'
import Dropdown from './Dropdown'
import { inventoryItemOption } from '../utils/inventoryOptions'
import { findAllergyMatches } from '../utils/consultation'

/**
 * Shared Medicine/Supply Picker for Nurse and Dentist Consultations
 * Features:
 * - Searchable dropdown (type to filter by name or category)
 * - Shows item name, category, available stock with unit
 * - Low stock warning (orange), out of stock disabled
 * - Added items: quantity stepper (capped by available stock), optional dosage note, remove button
 * - No duplicates (increase quantity instead)
 */
export function MedicineSupplyPicker({
  value = [], onChange, isEdit = false, consultationType = 'medical', consultationId = null,
  allergies = '', onAllergyMatches, onItemsStatus,
}) {
  const [dispensableItems, setDispensableItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Editing: the items this consultation already dispensed. Saving an edit gives back ALL of them and
  // dispenses only what is submitted, so the form must not be saved before they are loaded.
  // 'loading' | 'ready' | 'error'  (reported to the form through onItemsStatus)
  const editing = Boolean(isEdit && consultationId)
  const [itemsStatus, setItemsStatus] = useState(editing ? 'loading' : 'ready')
  const [itemsAttempt, setItemsAttempt] = useState(0)

  // Load dispensable inventory items
  useEffect(() => {
    inventoryApi.dispensable()
      .then(({ data }) => setDispensableItems(data.items || []))
      .catch(() => setDispensableItems([]))
      .finally(() => setLoading(false))
  }, [])

  // For edits, load existing dispensed items
  useEffect(() => {
    if (!editing) {
      setItemsStatus('ready')
      return undefined
    }
    let alive = true
    setItemsStatus('loading')
    inventoryApi.consultationItems(consultationType, consultationId)
      .then(({ data }) => {
        if (!alive) return
        const rows = (data.items || []).map(i => ({
          item_id: String(i.item_id),
          quantity: i.quantity,
          dosage_note: i.dosage_note || '',
        }))
        if (rows.length > 0) onChange(rows)
        setItemsStatus('ready')
      })
      .catch(() => { if (alive) setItemsStatus('error') })
    return () => { alive = false }
  }, [editing, consultationId, consultationType, itemsAttempt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onItemsStatus?.(itemsStatus) }, [itemsStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Get already added item IDs
  const addedItemIds = useMemo(() => new Set(value.map(v => String(v.item_id))), [value])

  // Allergy check: only when the patient's profile has allergy data
  const allergyMatches = useMemo(() => {
    const added = value
      .map(v => dispensableItems.find(i => String(i.id) === String(v.item_id)))
      .filter(Boolean)
    return findAllergyMatches(allergies, added)
  }, [allergies, value, dispensableItems])

  useEffect(() => { onAllergyMatches?.(allergyMatches) }, [allergyMatches]) // eslint-disable-line react-hooks/exhaustive-deps

  // Options for the shared Dropdown: name + category + available stock,
  // out-of-stock rows disabled, low stock (<= 10) in amber, already-added rows marked.
  const itemOptions = useMemo(() => dispensableItems.map(item => {
    const isAdded = addedItemIds.has(String(item.id))
    const isOutOfStock = item.current_stock === 0
    const isLowStock = item.current_stock > 0 && item.current_stock <= 10
    return inventoryItemOption(item, {
      sublabel: isOutOfStock ? 'Out of stock' : `${item.current_stock} ${item.unit}${isLowStock ? ' ⚠️' : ''}`,
      tone: isOutOfStock ? 'out' : isLowStock ? 'low' : undefined,
      disabled: isOutOfStock,
      highlighted: isAdded,
      tag: isAdded ? '✓ Added' : undefined,
    })
  }), [dispensableItems, addedItemIds])

  // Add an item to the list
  const handleAddItem = (itemId) => {
    const existing = value.find(v => String(v.item_id) === String(itemId))
    if (existing) {
      // Increase quantity if already added
      const item = dispensableItems.find(i => String(i.id) === String(itemId))
      const maxQty = item?.current_stock || 1
      onChange(value.map(v =>
        String(v.item_id) === String(itemId)
          ? { ...v, quantity: Math.min((v.quantity || 1) + 1, maxQty) }
          : v
      ))
    } else {
      // Add new item
      onChange([...value, { item_id: String(itemId), quantity: 1, dosage_note: '' }])
    }
  }

  // Update quantity for an item
  const handleQuantityChange = (itemId, newQty) => {
    const item = dispensableItems.find(i => String(i.id) === String(itemId))
    const maxQty = item?.current_stock || 1
    const clampedQty = Math.max(1, Math.min(parseInt(newQty) || 1, maxQty))
    onChange(value.map(v =>
      String(v.item_id) === String(itemId)
        ? { ...v, quantity: clampedQty }
        : v
    ))
  }

  // Update dosage note for an item
  const handleDosageChange = (itemId, note) => {
    onChange(value.map(v =>
      String(v.item_id) === String(itemId)
        ? { ...v, dosage_note: note }
        : v
    ))
  }

  // Remove an item from the list
  const handleRemove = (itemId) => {
    onChange(value.filter(v => String(v.item_id) !== String(itemId)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {itemsStatus === 'loading' && (
        <div className="form-hint" role="status">Loading the medicines already dispensed for this consultation…</div>
      )}
      {itemsStatus === 'error' && (
        <div className="consult-warning" role="alert">
          <span aria-hidden="true">⚠️</span>
          <div>
            <strong>The medicines already dispensed could not be loaded.</strong>{' '}
            Saving now would return them to stock, so Save is turned off until they load.
            <div style={{ marginTop: '0.4rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setItemsAttempt(n => n + 1)}>Try again</button>
            </div>
          </div>
        </div>
      )}

      {/* Searchable Dropdown (shared Dropdown: type to filter by name or category) */}
      <div>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem', color: 'var(--text)' }}>
          Add Medicine / Supply
        </label>
        <Dropdown
          options={itemOptions}
          value=""
          onChange={(itemId) => handleAddItem(itemId)}
          placeholder="Type to search by name or category..."
          loading={loading}
          emptyMessage="No items match your search"
          noOptionsMessage="No items available"
        />
      </div>

      {allergyMatches.length > 0 && (
        <div className="consult-warning" role="alert">
          <span aria-hidden="true">⚠️</span>
          <div>
            <strong>Allergy warning.</strong>{' '}
            {allergyMatches.map((m, i) => (
              <span key={m.item.id}>{i > 0 ? ' ' : ''}{m.item.name} may conflict with the patient&apos;s recorded allergy ({m.allergy}).</span>
            ))}
            <div style={{ marginTop: '0.2rem' }}>Please check with the patient before dispensing.</div>
          </div>
        </div>
      )}

      {/* Added Items List */}
      {value.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          padding: '0.75rem',
          background: 'var(--bg-crust)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: 'var(--text-sub)',
            marginBottom: '0.25rem',
          }}>
            Items to Dispense ({value.length})
          </div>

          {value.map((row) => {
            const item = dispensableItems.find(i => String(i.id) === String(row.item_id))
            if (!item) return null

            const maxQty = item.current_stock || 1
            const currentQty = row.quantity || 1

            return (
              <div
                key={row.item_id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  padding: '0.65rem',
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}
              >
                {/* Item Name and Remove Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', marginBottom: '0.15rem' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.category} • {item.current_stock} {item.unit} available
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '1.1rem',
                      padding: '0.25rem 0.5rem',
                      transition: 'color var(--transition)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--red)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>

                {/* Quantity Stepper and Dosage Note */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Quantity Stepper */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)' }}>
                      Quantity
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, currentQty - 1)}
                        disabled={currentQty <= 1}
                        style={{
                          width: '28px',
                          height: '28px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: currentQty <= 1 ? 'var(--bg-crust)' : '#FFFFFF',
                          color: currentQty <= 1 ? 'var(--text-muted)' : 'var(--accent)',
                          cursor: currentQty <= 1 ? 'not-allowed' : 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={maxQty}
                        value={currentQty}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        style={{
                          width: '55px',
                          padding: '0.35rem 0.5rem',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                          textAlign: 'center',
                          fontWeight: 600,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, currentQty + 1)}
                        disabled={currentQty >= maxQty}
                        style={{
                          width: '28px',
                          height: '28px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: currentQty >= maxQty ? 'var(--bg-crust)' : '#FFFFFF',
                          color: currentQty >= maxQty ? 'var(--text-muted)' : 'var(--accent)',
                          cursor: currentQty >= maxQty ? 'not-allowed' : 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        +
                      </button>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                        {item.unit}
                      </span>
                    </div>
                  </div>

                  {/* Dosage Note */}
                  <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)' }}>
                      Dosage / Instructions (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1 tablet 3x daily, 5ml every 4 hours..."
                      value={row.dosage_note || ''}
                      onChange={(e) => handleDosageChange(item.id, e.target.value)}
                      style={{
                        padding: '0.4rem 0.6rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
