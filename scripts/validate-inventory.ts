import { sql } from '../src/lib/db';
import {
  ensureInventorySchema,
  getInventoryDataset,
  addStockTransaction,
  adjustStockTransaction,
  getInventoryMovements,
  updateInventoryRecord,
  deleteInventoryRecord,
} from '../src/lib/inventory/inventory-service';

const FASHION_ACCOUNT_ID = '1323beea-04db-4d44-a1ca-3ab7a1556f09';
const COSMETICS_ACCOUNT_ID = 'e5839188-7241-4664-b8d6-ca209f3883ea';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(num: number, name: string, passed: boolean, details: string) {
  results.push({ num, name, passed, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] Test ${num}: ${name}`);
  console.log(`       ${details}\n`);
}

async function runInventoryValidation() {
  console.log('================================================================');
  console.log('REHANZA-HUB INVENTORY MANAGEMENT REBUILD — END-TO-END VALIDATION');
  console.log('================================================================\n');

  // TEST 1: Schema initialization
  try {
    await ensureInventorySchema();
    const [invCheck] = await sql`
      SELECT COUNT(*)::int as count 
      FROM information_schema.tables 
      WHERE table_name IN ('inventory', 'inventory_movements');
    `;
    record(
      1,
      'Idempotent Schema Migration',
      invCheck.count === 2,
      'Both inventory and inventory_movements tables verified in database.'
    );
  } catch (e: any) {
    record(1, 'Idempotent Schema Migration', false, e.message);
  }

  // TEST 2: Products -> Inventory Relationship using Main SKU
  const dataset = await getInventoryDataset(FASHION_ACCOUNT_ID);
  const hasProducts = dataset.items.length > 0;
  const allHaveMainSku = dataset.items.every((i) => !!i.mainSku && i.mainSku.trim().length > 0);
  record(
    2,
    'Products → Inventory Relationship via Main SKU',
    hasProducts && allHaveMainSku,
    `Loaded ${dataset.items.length} products into inventory master. 100% have valid Main SKUs.`
  );

  // TEST 3: Zero-Stock Fallback for Unrecorded Products
  const sampleUnstocked = dataset.items.find((i) => i.availableQuantity === 0);
  record(
    3,
    'Zero-Stock Fallback for Products without Inventory Records',
    !!sampleUnstocked && sampleUnstocked.status === 'Out of Stock',
    `Unstocked SKU [${sampleUnstocked?.mainSku}]: Available = ${sampleUnstocked?.availableQuantity}, Status = '${sampleUnstocked?.status}'.`
  );

  // TEST 4: KPI Calculations Accuracy
  let calcValue = 0;
  let calcUnits = 0;
  let calcLow = 0;
  let calcOut = 0;
  let calcReserved = 0;

  for (const item of dataset.items) {
    calcValue += item.inventoryValue;
    calcUnits += item.availableQuantity;
    calcReserved += item.reservedQuantity;
    if (item.availableQuantity === 0) calcOut++;
    else if (item.availableQuantity <= item.reorderLevel) calcLow++;
  }

  const kpisMatch =
    Math.abs(dataset.summary.totalInventoryValue - calcValue) < 0.01 &&
    dataset.summary.totalUnits === calcUnits &&
    dataset.summary.lowStockCount === calcLow &&
    dataset.summary.outOfStockCount === calcOut &&
    dataset.summary.reservedStockCount === calcReserved;

  record(
    4,
    'Accurate KPI Metrics Calculation',
    kpisMatch,
    `Total Value: ₹${dataset.summary.totalInventoryValue}, Units: ${dataset.summary.totalUnits}, Low Stock: ${dataset.summary.lowStockCount}, Out of Stock: ${dataset.summary.outOfStockCount}, Reserved: ${dataset.summary.reservedStockCount}.`
  );

  // TEST 5: Atomic Add Stock with Cost Price & Movement Log
  const testSku = `TEST-INV-${Date.now().toString().slice(-4)}`;
  const add1 = await addStockTransaction(FASHION_ACCOUNT_ID, {
    mainSku: testSku,
    quantity: 85,
    costPrice: 120,
    supplier: 'Abdul Raziq',
    location: 'Warehouse Bay 3',
    notes: 'PO-2026-901',
  });

  const addPassed1 =
    add1.inventory.available_quantity === 85 &&
    Number(add1.inventory.cost_price) === 120 &&
    add1.movement.movement_type === 'Stock In' &&
    add1.movement.quantity === 85 &&
    add1.movement.previous_quantity === 0 &&
    add1.movement.new_quantity === 85;

  record(
    5,
    'Add Stock Atomic Increment (Initial Stock)',
    addPassed1,
    `Added 85 units @ ₹120. Movement recorded: previous 0 → new 85. Cost price recorded as ₹${add1.inventory.cost_price}.`
  );

  // TEST 6: Subsequent Add Stock (No Overwrite, Increment Only)
  const add2 = await addStockTransaction(FASHION_ACCOUNT_ID, {
    mainSku: testSku,
    quantity: 50,
    costPrice: 120,
    notes: 'PO-2026-902',
  });

  const addPassed2 =
    add2.inventory.available_quantity === 135 &&
    add2.movement.previous_quantity === 85 &&
    add2.movement.new_quantity === 135;

  record(
    6,
    'Subsequent Add Stock (Strict Increment: 85 + 50 = 135)',
    addPassed2,
    `Current: 85, Add: 50 → New Available: ${add2.inventory.available_quantity}. Never overwritten.`
  );

  // TEST 7: Stock Value Valuation Formula (Available × Cost Price)
  const updatedDataset = await getInventoryDataset(FASHION_ACCOUNT_ID, { search: testSku });
  const testItem = updatedDataset.items.find((i) => i.mainSku === testSku);
  const expectedValue = 135 * 120; // ₹16,200

  record(
    7,
    'Inventory Valuation (Available × Cost Price = ₹16,200)',
    !!testItem && testItem.inventoryValue === expectedValue,
    `SKU [${testSku}]: 135 units × ₹120 = ₹${testItem?.inventoryValue} (Expected: ₹${expectedValue}).`
  );

  // TEST 8: Stock Adjustment (Damaged / Deduct)
  const adj1 = await adjustStockTransaction(FASHION_ACCOUNT_ID, {
    mainSku: testSku,
    adjustmentType: 'Damaged',
    adjustmentMode: 'delta',
    quantity: -5,
    reason: 'Water soaked box during transit',
    notes: 'Written off by warehouse manager',
  });

  const adjPassed1 =
    adj1.inventory.available_quantity === 130 &&
    adj1.movement.quantity === -5 &&
    adj1.movement.previous_quantity === 135 &&
    adj1.movement.new_quantity === 130 &&
    adj1.movement.movement_type === 'Damaged';

  record(
    8,
    'Stock Adjustment (Damaged write-off: 135 - 5 = 130)',
    adjPassed1,
    `Adjusted stock for damage: previous 135 → new 130. Movement recorded as '${adj1.movement.movement_type}'.`
  );

  // TEST 9: Strict Prevention of Negative Stock
  let negativePrevented = false;
  try {
    await adjustStockTransaction(FASHION_ACCOUNT_ID, {
      mainSku: testSku,
      adjustmentType: 'Correction',
      adjustmentMode: 'delta',
      quantity: -500,
      reason: 'Attempt invalid deduction',
    });
  } catch (err: any) {
    negativePrevented = err.message.includes('Cannot reduce stock below 0');
  }

  record(
    9,
    'Negative Stock Prevention Rule',
    negativePrevented,
    'Attempt to deduct 500 units from 130 available stock was cleanly blocked with user-facing validation error.'
  );

  // TEST 10: Stock Movement History Completeness
  const movements = await getInventoryMovements(FASHION_ACCOUNT_ID, { mainSku: testSku });
  const allMovementsPresent = movements.total === 3; // 2 adds + 1 adjustment
  record(
    10,
    'Audit Trail Completeness (Zero Silent Changes)',
    allMovementsPresent,
    `Total movements for [${testSku}]: ${movements.total}. Types: ${movements.movements
      .map((m) => `${m.movementType} (${m.quantity})`)
      .join(', ')}.`
  );

  // TEST 11: Multi-Tenant Account Isolation
  const cosmeticsData = await getInventoryDataset(COSMETICS_ACCOUNT_ID, { search: testSku });
  const isolationPassed = cosmeticsData.items.length === 0;
  record(
    11,
    'Multi-Tenant Data Isolation',
    isolationPassed,
    `Verified: Test SKU [${testSku}] does not appear in Cosmetics account. Strict account boundary maintained.`
  );

  // TEST 12: Edit/Update Inventory Record
  const updateRes = await updateInventoryRecord(FASHION_ACCOUNT_ID, {
    mainSku: testSku,
    availableQuantity: 140,
    reservedQuantity: 15,
    reorderLevel: 25,
    costPrice: 125,
    location: 'Warehouse Shelf B',
    reason: 'Quarterly physical stock audit',
    notes: 'Count adjusted by 10 units',
  });

  const updatePassed =
    updateRes.inventory.available_quantity === 140 &&
    updateRes.inventory.reserved_quantity === 15 &&
    updateRes.inventory.reorder_level === 25 &&
    Number(updateRes.inventory.cost_price) === 125 &&
    updateRes.inventory.location === 'Warehouse Shelf B' &&
    !!updateRes.movement &&
    updateRes.movement.quantity === 10 && // 140 - 130 = +10
    updateRes.movement.previous_quantity === 130 &&
    updateRes.movement.new_quantity === 140;

  record(
    12,
    'Edit/Update Inventory Record (Quantities, Thresholds, Location & Movement Audit)',
    updatePassed,
    `Updated SKU [${testSku}]: Available: ${updateRes.inventory.available_quantity}, Reserved: ${updateRes.inventory.reserved_quantity}, Reorder: ${updateRes.inventory.reorder_level}, Location: '${updateRes.inventory.location}'. Movement recorded: +10 units (${updateRes.movement?.previous_quantity} → ${updateRes.movement?.new_quantity}).`
  );

  // TEST 13: Delete Inventory Record (Product in Products Master is NOT Deleted)
  // Check main_products count before
  const [mpBefore] = await sql`SELECT COUNT(*)::int as c FROM main_products WHERE account_id = ${FASHION_ACCOUNT_ID};`;
  const [apBefore] = await sql`SELECT COUNT(*)::int as c FROM allproducts WHERE account_id = ${FASHION_ACCOUNT_ID};`;

  const deleteRes = await deleteInventoryRecord(FASHION_ACCOUNT_ID, testSku);

  const [invAfter] = await sql`SELECT COUNT(*)::int as c FROM inventory WHERE account_id = ${FASHION_ACCOUNT_ID} AND main_sku = ${testSku};`;
  const [mpAfter] = await sql`SELECT COUNT(*)::int as c FROM main_products WHERE account_id = ${FASHION_ACCOUNT_ID};`;
  const [apAfter] = await sql`SELECT COUNT(*)::int as c FROM allproducts WHERE account_id = ${FASHION_ACCOUNT_ID};`;

  const deletePassed =
    deleteRes.success &&
    invAfter.c === 0 &&
    mpAfter.c === mpBefore.c &&
    apAfter.c === apBefore.c;

  record(
    13,
    'Delete Inventory Record (Strict Isolation from Product Master)',
    deletePassed,
    `Inventory record deleted (remaining: ${invAfter.c}). Products master 100% preserved (main_products: ${mpAfter.c}, allproducts: ${apAfter.c}).`
  );

  // TEST 14: Zero-Stock Display After Deletion
  const datasetAfterDelete = await getInventoryDataset(FASHION_ACCOUNT_ID);
  const existingMasterProd = datasetAfterDelete.items[0];
  record(
    14,
    'Product Catalog Integrity After Inventory Record Deletion',
    datasetAfterDelete.items.length > 0 && !!existingMasterProd,
    `Inventory dataset continues to display all catalog products correctly. Sample: [${existingMasterProd?.mainSku}]: stock = ${existingMasterProd?.availableQuantity}.`
  );

  console.log('================================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`SUMMARY: ${results.filter((r) => r.passed).length} / ${results.length} TESTS PASSED.`);
  if (allPassed) {
    console.log('ALL 14/14 INVENTORY SYSTEM REQUIREMENTS VERIFIED SUCCESSFULLY!');
  } else {
    console.error('SOME INVENTORY TESTS FAILED!');
  }
  console.log('================================================================\n');

  if (!allPassed) process.exit(1);
  process.exit(0);
}

runInventoryValidation().catch((err) => {
  console.error('Validation script failed with error:', err);
  process.exit(1);
});

