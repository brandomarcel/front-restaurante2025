import { Injectable } from '@angular/core';
import { canSellProduct, canUseInventoryQuantity } from 'src/app/shared/utils/inventory.utils';
import { clampDiscountAmount, clampDiscountPercentage, computeLineTotals } from 'src/app/shared/utils/line-discount.utils';

/** Largo máximo de la nota de cocina de una línea ("sin azúcar", "sin cebolla"...). */
export const LINE_NOTE_MAX_LENGTH = 140;

@Injectable({ providedIn: 'root' })
export class CartService {

    cart: any[] = [];
    /** Identificador estable por línea: un mismo producto puede ocupar varias líneas con notas distintas. */
    private lineSeq = 0;
    /** Última línea agregada o incrementada: la UI la resalta y la deja a la vista. */
    lastTouchedLineId: number | null = null;

    /**
     * Suma una unidad a la línea del producto sin nota (o crea una). Las líneas
     * con nota quedan aparte para que cocina vea, por ejemplo, 1 jugo sin azúcar
     * y 1 normal.
     */
    addProduct(product: any): boolean {
        const existing = this.cart.find(i => this.sameProduct(i, product) && !i.notes && !i.removed_ingredients?.length);

        const price = Number(product.precio ?? product.price ?? 0);
        const taxValue = this.getTaxPercent(product);

        if (!this.canUseQuantity(product, this.quantityOf(product) + 1)) {
            return false;
        }
        if (existing) {
            existing.quantity++;
            this.recalcItem(existing);
            this.syncInventorySnapshot(existing, product);
            this.lastTouchedLineId = existing.line_id ?? null;
            return true;
        }
        const newItem = {
            ...product,
            line_id: ++this.lineSeq,
            nombre: product?.nombre ?? product?.name,
            price,
            quantity: 1,
            discount_percentage: 0,
            discount_amount: 0,
            tax_value: taxValue,
            notes: '',
            removed_ingredients: []
        };
        this.recalcItem(newItem);
        this.cart.push(newItem);
        this.lastTouchedLineId = newItem.line_id;
        return true;
    }

    /**
     * Guarda la nota de cocina de una línea. Con `onlyOneUnit` y cantidad > 1,
     * separa una unidad en su propia línea con la nota. Si ya existe otra línea
     * del mismo producto con la misma nota, se unen.
     */
    setNote(item: any, note: unknown, onlyOneUnit = false, removed: string[] = item?.removed_ingredients ?? []): void {
        const clean = String(note ?? '').replace(/\s+/g, ' ').trim().slice(0, LINE_NOTE_MAX_LENGTH);
        const removedKey = [...removed].sort().join('|');
        const sameRemoved = (i: any) => [...(i.removed_ingredients ?? [])].sort().join('|') === removedKey;
        let target = item;
        if (onlyOneUnit && Number(item.quantity) > 1 && (clean !== (item.notes || '') || !sameRemoved(item))) {
            item.quantity--;
            this.recalcItem(item);
            target = { ...item, line_id: ++this.lineSeq, quantity: 1, discount_amount: 0 };
            this.cart.splice(this.cart.indexOf(item) + 1, 0, target);
        }
        target.notes = clean;
        target.removed_ingredients = [...removed];
        this.recalcItem(target);

        const twin = this.cart.find(i => i !== target && this.sameProduct(i, target) && (i.notes || '') === clean && sameRemoved(i));
        if (twin) {
            twin.quantity += target.quantity;
            this.recalcItem(twin);
            this.cart.splice(this.cart.indexOf(target), 1);
        }
    }

    /** Unidades del producto en todas sus líneas (para validar stock). */
    quantityOf(product: any): number {
        return this.cart
            .filter(i => this.sameProduct(i, product))
            .reduce((acc, i) => acc + Number(i.quantity || 0), 0);
    }

    /** Descuento porcentual de una línea (0-100). */
    setDiscountPercentage(item: any, value: unknown): void {
        item.discount_percentage = clampDiscountPercentage(value);
        this.recalcItem(item);
    }

    /** Descuento fijo en dólares de una línea (nunca negativo ni mayor al subtotal). */
    setDiscountAmount(item: any, value: unknown): void {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const subtotalBruto = qty * price;
        const discountFromPercentage = subtotalBruto * (Number(item.discount_percentage) || 0) / 100;
        item.discount_amount = clampDiscountAmount(value, subtotalBruto - discountFromPercentage);
        this.recalcItem(item);
    }

    /** Suma de los descuentos (porcentaje + fijo) de todo el carrito. Solo lectura. */
    get totalDiscount(): number {
        return this.round2(this.cart.reduce((acc, it) => acc + Number(it.discount_total || 0), 0));
    }

    increase(item: any): boolean {
        if (!this.canIncrease(item)) {
            return false;
        }
        item.quantity++;
        this.recalcItem(item);
        return true;
    }

    decrease(item: any) {
        if (item.quantity > 1) {
            item.quantity--;
            this.recalcItem(item);
        } else {
            const i = this.cart.indexOf(item);
            if (i !== -1) this.cart.splice(i, 1);
        }
    }

    clear() {
        this.cart = [];
        this.lastTouchedLineId = null;
    }

    private sameProduct(a: any, b: any): boolean {
        return (a?.name ?? a?.nombre) === (b?.name ?? b?.nombre);
    }

    get subtotal(): number {
        return this.round2(
            this.cart.reduce((acc, it) => acc + Number(it.subtotal || 0), 0)
        );
    }

    get iva(): number {
        return this.round2(
            this.cart.reduce((acc, it) => acc + Number(it.iva || 0), 0)
        );
    }

    get total(): number {
        return this.round2(
            this.cart.reduce((acc, it) => acc + Number(it.total || 0), 0)
        );
    }

    canAddProduct(product: any): boolean {
        return canSellProduct(product) && this.canUseQuantity(product, this.quantityOf(product) + 1);
    }

    canIncrease(item: any): boolean {
        return canSellProduct(item) && this.canUseQuantity(item, this.quantityOf(item) + 1);
    }

    private recalcItem(item: any) {
        const result = computeLineTotals({
            qty: Number(item.quantity),
            rate: Number(item.price),
            discountPercentage: item.discount_percentage,
            discountAmount: item.discount_amount,
            taxRate: Number(item.tax_value)
        });

        item.discount_percentage = clampDiscountPercentage(item.discount_percentage);
        item.subtotal_bruto = result.subtotalBruto;
        item.discount_total = result.totalDiscount;
        item.subtotal = result.baseImponible;
        item.iva = result.iva;
        item.total = result.total;
    }

    private round2(n: number) {
        return Math.round((n + Number.EPSILON) * 100) / 100;
    }

    private canUseQuantity(product: any, quantity: number): boolean {
        return canUseInventoryQuantity(product, quantity);
    }

    private getTaxPercent(product: any): number {
        const value = Number(product?.tax_value ?? product?.tax?.value ?? product?.tax ?? 0);
        return Number.isFinite(value) ? value : 0;
    }

    private syncInventorySnapshot(target: any, source: any): void {
        target.controlar_inventario = source?.controlar_inventario ?? target.controlar_inventario;
        target.permitir_stock_negativo = source?.permitir_stock_negativo ?? target.permitir_stock_negativo;
        target.stock_actual = source?.stock_actual ?? target.stock_actual;
        target.stock_minimo = source?.stock_minimo ?? target.stock_minimo;
        target.is_out_of_stock = source?.is_out_of_stock ?? target.is_out_of_stock;
        target.unidad_inventario = source?.unidad_inventario ?? target.unidad_inventario;
        target.portions_available = source?.portions_available ?? target.portions_available;
    }
}
