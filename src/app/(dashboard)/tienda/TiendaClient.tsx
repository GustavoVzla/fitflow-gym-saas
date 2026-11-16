'use client'

import { useMemo, useState, useTransition } from 'react'
import { ShoppingBag, Plus, Power, Trash2, Package, Tag } from 'lucide-react'
import type { ShopProduct, ShopOrder } from './data'
import {
  createProductAction,
  toggleProductAction,
  deleteProductAction,
  updateOrderStatusAction,
} from './actions'

interface Props {
  products: ShopProduct[]
  orders: ShopOrder[]
  categories: string[]
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Cobrado', cls: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  fulfilled: { label: 'Entregado', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
  refunded: { label: 'Devuelto', cls: 'bg-red-100 text-red-700' },
}

function formatEUR(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function TiendaClient({ products, orders, categories }: Props) {
  const [tab, setTab] = useState<'products' | 'categories' | 'orders'>('products')
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const productsByCategory = useMemo(() => {
    const map = new Map<string, number>()
    products.forEach((p) => {
      const key = p.category ?? 'Sin categoría'
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [products])

  function handleCreate(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createProductAction({}, formData)
      if (res.error) {
        setError(res.error)
        return
      }
      setModalOpen(false)
    })
  }

  function handleToggle(id: string, active: boolean) {
    startTransition(() => void toggleProductAction(id, !active))
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este producto?')) return
    startTransition(() => void deleteProductAction(id))
  }

  function handleOrderStatus(id: string, newStatus: 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded') {
    startTransition(() => void updateOrderStatusAction(id, newStatus))
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-[var(--brand-color,#0B4B8C)]" />
            Tienda
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Catálogo de productos físicos, categorías y ventas. Paridad LegacyGym /shop.
          </p>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Productos activos</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {products.filter((p) => p.isActive).length}
          </p>
          <p className="text-xs text-slate-400 mt-1">{products.length} totales</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Ventas (últimas 200)</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{orders.length}</p>
          <p className="text-xs text-slate-400 mt-1">
            {orders.filter((o) => o.status === 'pending').length} pendientes
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Ingresos tienda</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {formatEUR(orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.total, 0))}
          </p>
          <p className="text-xs text-slate-400 mt-1">Cobrado total</p>
        </div>
      </div>

      <div className="border-b border-slate-200 flex gap-6">
        {(['products', 'categories', 'orders'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-[var(--brand-color,#0B4B8C)] text-[var(--brand-color,#0B4B8C)]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'products' && `Productos ${products.length > 0 ? `(${products.length})` : ''}`}
            {t === 'categories' &&
              `Categorías ${productsByCategory.length > 0 ? `(${productsByCategory.length})` : ''}`}
            {t === 'orders' && `Ventas ${orders.length > 0 ? `(${orders.length})` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {products.length === 0
                ? 'Aún no hay productos. Crea el primero.'
                : 'Gestiona precio, stock y estado'}
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-color,#0B4B8C)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Nuevo producto
            </button>
          </div>

          {products.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Producto</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Categoría</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Precio</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Stock</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{p.name}</p>
                          {p.barcode && (
                            <span className="text-[10px] font-mono text-slate-400" title={`EAN: ${p.barcode}`}>
                              #{p.barcode.slice(-6)}
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-xs text-slate-500 line-clamp-1">{p.description}</p>
                        )}
                        {p.marginEuros != null && (
                          <p className="text-[10px] text-emerald-600 mt-0.5">
                            Margen {formatEUR(p.marginEuros)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.category ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatEUR(p.price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            p.stock === 0
                              ? 'text-red-600 font-medium'
                              : p.isLowStock
                                ? 'text-amber-600 font-medium'
                                : 'text-slate-600'
                          }
                          title={p.stockMin != null ? `Mínimo ${p.stockMin}` : undefined}
                        >
                          {p.stock}
                          {p.isLowStock && p.stock > 0 && (
                            <span className="ml-1 text-[10px]">⚠</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {p.isActive ? 'Activo' : 'Oculto'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => handleToggle(p.id, p.isActive)}
                            disabled={isPending}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                            title={p.isActive ? 'Ocultar' : 'Activar'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={isPending}
                            className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'categories' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          {productsByCategory.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Sin categorías. Crea productos con categoría para verlas agrupadas aquí.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Categoría</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Productos</th>
                </tr>
              </thead>
              <tbody>
                {productsByCategory.map((c) => (
                  <tr key={c.name} className="border-t border-slate-100">
                    <td className="px-4 py-3 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{c.name}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'orders' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <Package className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              Aún no hay ventas. Cuando registres una, aparecerá aquí.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Socio</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Items</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Nº pedido</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const s = STATUS_LABEL[o.status] ?? STATUS_LABEL.pending
                  return (
                    <tr key={o.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(o.createdAt).toLocaleString('es-ES', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: 'Europe/Madrid',
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {o.memberName ?? '— Cliente puntual —'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{o.itemsCount}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatEUR(o.total)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{o.orderNumber}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {o.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleOrderStatus(o.id, 'paid')}
                              disabled={isPending}
                              className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              title="Marcar como cobrado"
                            >
                              Cobrar
                            </button>
                          )}
                          {o.status === 'paid' && (
                            <button
                              type="button"
                              onClick={() => handleOrderStatus(o.id, 'fulfilled')}
                              disabled={isPending}
                              className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                              title="Marcar entregado al socio"
                            >
                              Entregar
                            </button>
                          )}
                          {(o.status === 'pending' || o.status === 'paid') && (
                            <button
                              type="button"
                              onClick={() => handleOrderStatus(o.id, 'cancelled')}
                              disabled={isPending}
                              className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                              title="Cancelar pedido"
                            >
                              Cancelar
                            </button>
                          )}
                          {o.status === 'paid' && (
                            <button
                              type="button"
                              onClick={() => handleOrderStatus(o.id, 'refunded')}
                              disabled={isPending}
                              className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                              title="Emitir reembolso"
                            >
                              Reembolsar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <p className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100">
            * Registro de ventas Base: sin gateway integrado. Para cobro online usa /pagos (Stripe).
          </p>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200">
              <h3 className="font-semibold text-lg text-slate-900">Nuevo producto</h3>
            </div>
            <form action={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700">Nombre *</label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Ej: Camiseta Demo Studio"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Descripción</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Opcional"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Precio € *</label>
                  <input
                    name="price"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    defaultValue="0.00"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Stock *</label>
                  <input
                    name="stock"
                    type="number"
                    min={0}
                    step="1"
                    required
                    defaultValue="0"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Categoría</label>
                  <input
                    name="category"
                    type="text"
                    list="categories-list"
                    placeholder="Ej: Ropa"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                  <datalist id="categories-list">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Extensiones 0074 — campos opcionales */}
              <details className="rounded-md border border-slate-200">
                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Detalles avanzados (opcional)
                </summary>
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700">
                        Precio de compra €
                      </label>
                      <input
                        name="costPrice"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Calcula margen"
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">
                        Stock mínimo
                      </label>
                      <input
                        name="stockMin"
                        type="number"
                        min={0}
                        step="1"
                        placeholder="Alerta reposición"
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700">SKU</label>
                      <input
                        name="sku"
                        type="text"
                        maxLength={60}
                        placeholder="Opcional"
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">
                        Código barras (EAN)
                      </label>
                      <input
                        name="barcode"
                        type="text"
                        maxLength={32}
                        placeholder="8412345678901"
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">
                      URL de imagen
                    </label>
                    <input
                      name="imageUrl"
                      type="url"
                      placeholder="https://..."
                      className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Upload bucket gym-assets pendiente — pega URL por ahora.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">
                      Atributos (JSON)
                    </label>
                    <textarea
                      name="attributes"
                      rows={2}
                      placeholder='{"talla":"M","color":"negro"}'
                      className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-mono resize-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      JSON libre: talla, color, material, etc. Si inválido se guarda vacío.
                    </p>
                  </div>
                </div>
              </details>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-2">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm rounded-md bg-[var(--brand-color,#0B4B8C)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? 'Creando...' : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
