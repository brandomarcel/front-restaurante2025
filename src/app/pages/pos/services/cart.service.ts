import { Injectable } from '@angular/core';
import { canSellProduct, canUseInventoryQuantity } from 'src/app/shared/utils/inventory.utils';

@Injectable({ providedIn: 'root' })
export class CartService {

    cart: any[] = [];

    addProduct(product: any): boolean {
        const existing = this.cart.find(
            i => (i.name ?? i.nombre) === (product.name ?? product.nombre)
        );

        const price = Number(product.precio ?? product.price ?? 0);
        const taxValue = this.getTaxPercent(product);

        if (existing) {
            if (!this.canUseQuantity(product, Number(existing.quantity || 0) + 1)) {
                return false;
            }
            existing.quantity++;
            this.recalcItem(existing);
            this.syncInventorySnapshot(existing, product);
            return true;
        } else {
            if (!this.canUseQuantity(product, 1)) {
                return false;
            }
            const newItem = {
                ...product,
                nombre: product?.nombre ?? product?.name,
                price,
                quantity: 1,
                tax_value: taxValue
            };
            this.recalcItem(newItem);
            this.cart.push(newItem);
            return true;
        }
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
        const existing = this.cart.find(
            i => (i.name ?? i.nombre) === (product.name ?? product.nombre)
        );
        const nextQuantity = Number(existing?.quantity || 0) + 1;
        return canSellProduct(product) && this.canUseQuantity(product, nextQuantity);
    }

    canIncrease(item: any): boolean {
        return canSellProduct(item) && this.canUseQuantity(item, Number(item?.quantity || 0) + 1);
    }

    private recalcItem(item: any) {
        const qty = Number(item.quantity);
        const price = Number(item.price);
        const taxRate = Number(item.tax_value) / 100;

        const subtotal = this.round2(qty * price);
        const iva = this.round2(subtotal * taxRate);

        item.subtotal = subtotal;
        item.iva = iva;
        item.total = this.round2(subtotal + iva);
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
    }
}
