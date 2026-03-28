import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Simple global property store using module-level state
let _propertyId = null
let _listeners = []

export function setPropertyId(id) {
  _propertyId = id
  _listeners.forEach(fn => fn(id))
  if (id) localStorage.setItem('blite_property_id', id)
}

export function useProperty() {
  const [propertyId, setLocal] = useState(
    _propertyId || localStorage.getItem('blite_property_id') || null
  )
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const listener = (id) => setLocal(id)
    _listeners.push(listener)

    // Load properties for this user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('properties').select('id, name, address').eq('owner_id', user.id)
        .then(({ data }) => {
          if (data?.length) {
            setProperties(data)
            if (!_propertyId) {
              const saved = localStorage.getItem('blite_property_id')
              const first = saved && data.find(p => p.id === saved) ? saved : data[0].id
              setPropertyId(first)
              setLocal(first)
            }
          }
          setLoading(false)
        })
    })

    return () => { _listeners = _listeners.filter(l => l !== listener) }
  }, [])

  return { propertyId, properties, loading }
}
