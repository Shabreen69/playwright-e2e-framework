// tests/purchase-journey.spec.ts
import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ProductPage } from '../pages/ProductPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ConfirmationPage } from '../pages/ConfirmationPage';
import { testUsers } from '../fixtures/users';
import { scooterModels } from '../fixtures/products';

/**
 * EV Purchase Journey — end-to-end tests for the Ola Electric scooter
 * purchase flow across web (desktop + mWeb).
 *
 * Covers: login → model selection → configuration → checkout → confirmation
 */

test.describe('EV Scooter Purchase Journey', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Ola Electric/);
  });

  // ── Happy path ────────────────────────────────────────────────

  test('complete purchase journey for S1 Pro', async ({ page }) => {
    const login   = new LoginPage(page);
    const product = new ProductPage(page);
    const checkout = new CheckoutPage(page);
    const confirm  = new ConfirmationPage(page);

    // Step 1: Login
    await login.goto();
    await login.loginAs(testUsers.validUser.email, testUsers.validUser.password);
    await expect(page).toHaveURL(/dashboard/);

    // Step 2: Select model
    await product.goto();
    await product.selectModel(scooterModels.s1Pro.name);
    await expect(product.getSelectedModel()).resolves.toBe(scooterModels.s1Pro.name);

    // Step 3: Configure colour
    await product.selectColour('Jet Black');
    await expect(product.getSelectedColour()).resolves.toBe('Jet Black');

    // Step 4: Proceed to checkout
    await product.clickBuyNow();
    await expect(page).toHaveURL(/checkout/);

    // Step 5: Fill address
    await checkout.fillDeliveryAddress({
      fullName: 'Shabreen Taj',
      phone: '9538636519',
      pincode: '560032',
      city: 'Bengaluru',
      state: 'Karnataka'
    });

    // Step 6: Select payment
    await checkout.selectPaymentMethod('UPI');
    await checkout.enterUPI('test@upi');

    // Step 7: Confirm order
    await checkout.clickPlaceOrder();
    await expect(page).toHaveURL(/order-confirmation/);

    // Step 8: Validate confirmation
    const orderId = await confirm.getOrderId();
    expect(orderId).toMatch(/^OLA-[0-9]{8}$/);
    await expect(confirm.getDeliveryEstimate()).resolves.not.toBeNull();
    await expect(confirm.getOrderSummary()).resolves.toContain('S1 Pro');
  });

  // ── Validation tests ──────────────────────────────────────────

  test('checkout should block with invalid pincode', async ({ page }) => {
    const login   = new LoginPage(page);
    const checkout = new CheckoutPage(page);

    await login.loginAs(testUsers.validUser.email, testUsers.validUser.password);
    await page.goto('/checkout');
    await checkout.fillDeliveryAddress({ pincode: '000000' });
    await checkout.clickPlaceOrder();

    await expect(page.locator('[data-testid="pincode-error"]'))
      .toContainText('We do not deliver to this location');
  });

  test('should show out-of-stock message when variant unavailable', async ({ page }) => {
    const product = new ProductPage(page);
    await new LoginPage(page).loginAs(testUsers.validUser.email, testUsers.validUser.password);
    await product.goto();
    await product.selectModel('S1 Air');
    await product.selectColour('Coral Glam');

    const buyButton = page.locator('[data-testid="buy-now-btn"]');
    const stockBadge = page.locator('[data-testid="stock-badge"]');

    // Either buy button is enabled OR out-of-stock badge shows
    const isBuyEnabled = await buyButton.isEnabled().catch(() => false);
    if (!isBuyEnabled) {
      await expect(stockBadge).toBeVisible();
    }
  });

  // ── mWeb responsive tests ─────────────────────────────────────

  test('purchase CTA should be visible on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    const product = new ProductPage(page);
    await new LoginPage(page).loginAs(testUsers.validUser.email, testUsers.validUser.password);
    await product.goto();
    await product.selectModel('S1 Pro');

    const buyButton = page.locator('[data-testid="buy-now-btn"]');
    await expect(buyButton).toBeVisible();
    await expect(buyButton).toBeInViewport();
  });

  // ── Accessibility ─────────────────────────────────────────────

  test('checkout page should have no critical accessibility violations', async ({ page }) => {
    const { checkA11y, injectAxe } = await import('axe-playwright');
    await new LoginPage(page).loginAs(testUsers.validUser.email, testUsers.validUser.password);
    await page.goto('/checkout');
    await injectAxe(page);
    await checkA11y(page, undefined, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
    });
  });

  // ── Invoice validation ────────────────────────────────────────

  test('invoice download should return a valid PDF', async ({ page }) => {
    await new LoginPage(page).loginAs(testUsers.validUser.email, testUsers.validUser.password);
    await page.goto('/orders');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="download-invoice-btn"]').first().click()
    ]);

    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const path = await download.path();
    expect(path).not.toBeNull();
  });
});
