import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CartService {

    cart: any[] = [];

    addProduct(product: any) {
        const existing = this.cart.find(
            i => (i.name ?? i.nombre) === (product.name ?? product.nombre)
        );

        const price = Number(product.precio ?? product.price ?? 0);
        const taxValue = Number(product.tax_value ?? 0);

        if (existing) {
            existing.quantity++;
            this.recalcItem(existing);
        } else {
            const newItem = {
                ...product,
                nombre: product?.nombre ?? product?.name,
                price,
                quantity: 1,
                tax_value: taxValue
            };
            this.recalcItem(newItem);
            this.cart.push(newItem);
        }
    }

    increase(item: any) {
        item.quantity++;
        this.recalcItem(item);
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
}
