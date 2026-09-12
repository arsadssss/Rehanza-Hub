import { sql } from '@/lib/db';
import { ensureInventorySchema } from './inventory-migration';

export { ensureInventorySchema };

export interface InventoryItem {
  id: string;
  inventoryId?: string;
  mainSku: string;
  productName: string;
  category: string;
  costPrice: number;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
  reorderLevel: number;
  inventoryValue: number;
  status: 'Healthy' | 'Low Stock' | 'Out of Stock';
  location: string;
  updatedAt?: string;
}

export interface InventoryKpis {
  totalInventoryValue: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  reservedStockCount: number;
  totalSkus: number;
}

export interface StockMovement {
  id: string;
  inventoryId: string;
  mainSku: string;
  productName?: string;
  movementType: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  costPrice: number;
  supplier: string | null;
  batchLot: string | null;
  location: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AddStockPayload {
  mainSku: string;
  quantity: number;
  costPrice?: number;
  supplier?: string;
  batchLot?: string;
  location?: string;
  notes?: string;
}

export interface AdjustStockPayload {
  mainSku: string;
  adjustmentType: string; // 'Damaged' | 'Lost' | 'Correction' | 'Manual Adjustment' | 'Other'
  adjustmentMode: 'set' | 'delta'; // 'set' sets exact total, 'delta' adds/subtracts
  quantity: number;
  reason: string;
  location?: string;
  notes?: string;
}

/**
 * 1. Fetch unified SKU-level Inventory Dataset + KPIs
 * Linked strictly to existing Products master (main_products / allproducts) by Main SKU.
 */
export async function getInventoryDataset(
  accountId: string,
  options?: {
    search?: string;
    category?: string;
    status?: string;
  }
): Promise<{
  summary: InventoryKpis;
  items: InventoryItem[];
  categories: string[];
}> {
  await ensureInventorySchema();

  // 1. Fetch Main Products (authoritative two-tier catalog)
  const mainProducts = await sql`
    SELECT 
      mp.id,
      mp.name,
      mp.main_sku,
      COALESCE(mp.category, 'General') as category,
      COALESCE(AVG(ps.purchase_cost), 0)::numeric as avg_cost_price
    FROM main_products mp
    LEFT JOIN product_skus ps ON mp.id = ps.main_product_id
    WHERE mp.account_id = ${accountId}
    GROUP BY mp.id, mp.name, mp.main_sku, mp.category
    ORDER BY mp.created_at DESC;
  `;

  // 2. Fetch any active allproducts whose sku is not already in main_products
  const existingMainSkus = new Set(mainProducts.map((p) => p.main_sku.trim().toLowerCase()));
  const allProds = await sql`
    SELECT 
      id,
      sku as main_sku,
      product_name as name,
      COALESCE(category, 'General') as category,
      COALESCE(cost_price, 0)::numeric as cost_price
    FROM allproducts
    WHERE account_id = ${accountId} AND is_deleted = false
    ORDER BY created_at DESC;
  `;

  // Combine product master records
  const masterProducts: Array<{
    id: string;
    name: string;
    mainSku: string;
    category: string;
    baseCost: number;
  }> = [];

  for (const mp of mainProducts) {
    masterProducts.push({
      id: mp.id,
      name: mp.name,
      mainSku: mp.main_sku,
      category: mp.category,
      baseCost: Number(mp.avg_cost_price || 0),
    });
  }

  for (const ap of allProds) {
    if (!existingMainSkus.has(ap.main_sku.trim().toLowerCase())) {
      masterProducts.push({
        id: ap.id,
        name: ap.name,
        mainSku: ap.main_sku,
        category: ap.category,
        baseCost: Number(ap.cost_price || 0),
      });
      existingMainSkus.add(ap.main_sku.trim().toLowerCase());
    }
  }

  // 3. Fetch existing inventory rows
  const inventoryRows = await sql`
    SELECT 
      id,
      main_sku,
      available_quantity,
      reserved_quantity,
      reorder_level,
      cost_price,
      location,
      updated_at
    FROM inventory
    WHERE account_id = ${accountId};
  `;

  const inventoryMap = new Map<string, any>();
  for (const row of inventoryRows) {
    inventoryMap.set(row.main_sku.trim().toLowerCase(), row);
  }

  // 4. Build unified inventory items
  const allItems: InventoryItem[] = masterProducts.map((prod) => {
    const inv = inventoryMap.get(prod.mainSku.trim().toLowerCase());
    const availableQuantity = inv ? Number(inv.available_quantity || 0) : 0;
    const reservedQuantity = inv ? Number(inv.reserved_quantity || 0) : 0;
    const totalQuantity = availableQuantity + reservedQuantity;
    const reorderLevel = inv ? Number(inv.reorder_level || 10) : 10;
    const location = inv?.location || 'Main Warehouse';

    // Cost Price determination:
    // 1. Explicit inventory record cost_price (from Add Stock)
    // 2. Base cost from linked product_skus or allproducts
    // 3. 0 if missing
    let costPrice = 0;
    if (inv && Number(inv.cost_price) > 0) {
      costPrice = Math.round(Number(inv.cost_price) * 100) / 100;
    } else if (prod.baseCost > 0) {
      costPrice = Math.round(prod.baseCost * 100) / 100;
    }

    const inventoryValue = Math.round(availableQuantity * costPrice * 100) / 100;

    let status: 'Healthy' | 'Low Stock' | 'Out of Stock';
    if (availableQuantity === 0) {
      status = 'Out of Stock';
    } else if (availableQuantity <= reorderLevel) {
      status = 'Low Stock';
    } else {
      status = 'Healthy';
    }

    return {
      id: prod.id,
      inventoryId: inv?.id,
      mainSku: prod.mainSku,
      productName: prod.name,
      category: prod.category,
      costPrice,
      availableQuantity,
      reservedQuantity,
      totalQuantity,
      reorderLevel,
      inventoryValue,
      status,
      location,
      updatedAt: inv?.updated_at || undefined,
    };
  });

  // Also include any inventory record whose main_sku is not in products (e.g. direct inventory entries)
  for (const inv of inventoryRows) {
    const norm = inv.main_sku.trim().toLowerCase();
    if (!existingMainSkus.has(norm)) {
      const availableQuantity = Number(inv.available_quantity || 0);
      const reservedQuantity = Number(inv.reserved_quantity || 0);
      const totalQuantity = availableQuantity + reservedQuantity;
      const reorderLevel = Number(inv.reorder_level || 10);
      const costPrice = Math.round(Number(inv.cost_price || 0) * 100) / 100;
      const inventoryValue = Math.round(availableQuantity * costPrice * 100) / 100;

      let status: 'Healthy' | 'Low Stock' | 'Out of Stock';
      if (availableQuantity === 0) {
        status = 'Out of Stock';
      } else if (availableQuantity <= reorderLevel) {
        status = 'Low Stock';
      } else {
        status = 'Healthy';
      }

      allItems.push({
        id: inv.id,
        inventoryId: inv.id,
        mainSku: inv.main_sku,
        productName: inv.main_sku,
        category: 'Uncategorized',
        costPrice,
        availableQuantity,
        reservedQuantity,
        totalQuantity,
        reorderLevel,
        inventoryValue,
        status,
        location: inv.location || 'Main Warehouse',
        updatedAt: inv.updated_at,
      });
      existingMainSkus.add(norm);
    }
  }

  // 5. Calculate KPI Summary
  let totalInventoryValue = 0;
  let totalUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let reservedStockCount = 0;

  for (const item of allItems) {
    totalInventoryValue += item.inventoryValue;
    totalUnits += item.availableQuantity;
    reservedStockCount += item.reservedQuantity;
    if (item.availableQuantity === 0) {
      outOfStockCount++;
    } else if (item.availableQuantity <= item.reorderLevel) {
      lowStockCount++;
    }
  }

  const summary: InventoryKpis = {
    totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
    totalUnits,
    lowStockCount,
    outOfStockCount,
    reservedStockCount,
    totalSkus: allItems.length,
  };

  // Distinct categories
  const categories = Array.from(new Set(allItems.map((i) => i.category).filter(Boolean))).sort();

  // 6. Apply search and filters
  let filtered = allItems;
  if (options?.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    filtered = filtered.filter(
      (item) => item.mainSku.toLowerCase().includes(q) || item.productName.toLowerCase().includes(q)
    );
  }

  if (options?.category && options.category !== 'all') {
    filtered = filtered.filter((item) => item.category === options.category);
  }

  if (options?.status && options.status !== 'all') {
    filtered = filtered.filter((item) => item.status === options.status);
  }

  return {
    summary,
    items: filtered,
    categories,
  };
}

/**
 * 2. Add Stock (Atomic increment + Movement History)
 */
export async function addStockTransaction(
  accountId: string,
  payload: AddStockPayload
): Promise<{ inventory: any; movement: any }> {
  await ensureInventorySchema();

  const normSku = payload.mainSku?.trim();
  const quantityToAdd = Number(payload.quantity);
  const costPrice = payload.costPrice !== undefined ? Number(payload.costPrice) : undefined;

  if (!normSku) {
    throw new Error('Main SKU is required.');
  }
  if (!quantityToAdd || quantityToAdd <= 0 || !Number.isInteger(quantityToAdd)) {
    throw new Error('Quantity to add must be a positive integer.');
  }
  if (costPrice !== undefined && costPrice < 0) {
    throw new Error('Cost Price cannot be negative.');
  }

  // 1. Fetch current inventory row if exists
  const [existing] = await sql`
    SELECT id, available_quantity, reserved_quantity, reorder_level, cost_price, location
    FROM inventory
    WHERE account_id = ${accountId} AND LOWER(main_sku) = LOWER(${normSku});
  `;

  const previousQuantity = existing ? Number(existing.available_quantity || 0) : 0;
  const newQuantity = previousQuantity + quantityToAdd;
  const effectiveCost =
    costPrice !== undefined && costPrice > 0
      ? costPrice
      : existing && Number(existing.cost_price) > 0
      ? Number(existing.cost_price)
      : 0;

  const location = payload.location?.trim() || existing?.location || 'Main Warehouse';

  let inventoryRecord: any;

  if (existing) {
    const [updated] = await sql`
      UPDATE inventory
      SET 
        available_quantity = ${newQuantity},
        cost_price = ${effectiveCost},
        location = ${location},
        updated_at = NOW()
      WHERE id = ${existing.id}
      RETURNING *;
    `;
    inventoryRecord = updated;
  } else {
    const [inserted] = await sql`
      INSERT INTO inventory (
        account_id,
        main_sku,
        available_quantity,
        reserved_quantity,
        reorder_level,
        cost_price,
        location,
        created_at,
        updated_at
      ) VALUES (
        ${accountId},
        ${normSku},
        ${newQuantity},
        0,
        10,
        ${effectiveCost},
        ${location},
        NOW(),
        NOW()
      )
      RETURNING *;
    `;
    inventoryRecord = inserted;
  }

  // 2. Record Movement History
  const [movement] = await sql`
    INSERT INTO inventory_movements (
      account_id,
      inventory_id,
      main_sku,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      cost_price,
      supplier,
      batch_lot,
      location,
      reason,
      notes,
      created_at
    ) VALUES (
      ${accountId},
      ${inventoryRecord.id},
      ${normSku},
      'Stock In',
      ${quantityToAdd},
      ${previousQuantity},
      ${newQuantity},
      ${effectiveCost},
      ${payload.supplier?.trim() || null},
      ${payload.batchLot?.trim() || null},
      ${location},
      'Stock In',
      ${payload.notes?.trim() || null},
      NOW()
    )
    RETURNING *;
  `;

  return { inventory: inventoryRecord, movement };
}

/**
 * 3. Stock Adjustment (Atomic adjustment + Movement History)
 */
export async function adjustStockTransaction(
  accountId: string,
  payload: AdjustStockPayload
): Promise<{ inventory: any; movement: any }> {
  await ensureInventorySchema();

  const normSku = payload.mainSku?.trim();
  const quantityInput = Number(payload.quantity);
  const adjustmentType = payload.adjustmentType?.trim() || 'Adjustment';
  const reason = payload.reason?.trim();

  if (!normSku) {
    throw new Error('Main SKU is required.');
  }
  if (!reason) {
    throw new Error('Reason is required for stock adjustments.');
  }
  if (isNaN(quantityInput) || !Number.isInteger(quantityInput)) {
    throw new Error('Quantity must be an integer.');
  }

  // Fetch current inventory row
  const [existing] = await sql`
    SELECT id, available_quantity, reserved_quantity, reorder_level, cost_price, location
    FROM inventory
    WHERE account_id = ${accountId} AND LOWER(main_sku) = LOWER(${normSku});
  `;

  const previousQuantity = existing ? Number(existing.available_quantity || 0) : 0;
  let newQuantity: number;

  if (payload.adjustmentMode === 'set') {
    if (quantityInput < 0) {
      throw new Error('Available stock cannot be set to a negative number.');
    }
    newQuantity = quantityInput;
  } else {
    // delta mode
    newQuantity = previousQuantity + quantityInput;
    if (newQuantity < 0) {
      throw new Error(
        `Cannot reduce stock below 0. Current available stock is ${previousQuantity}, requested reduction is ${Math.abs(
          quantityInput
        )}.`
      );
    }
  }

  const delta = newQuantity - previousQuantity;
  const location = payload.location?.trim() || existing?.location || 'Main Warehouse';

  let inventoryRecord: any;

  if (existing) {
    const [updated] = await sql`
      UPDATE inventory
      SET 
        available_quantity = ${newQuantity},
        location = ${location},
        updated_at = NOW()
      WHERE id = ${existing.id}
      RETURNING *;
    `;
    inventoryRecord = updated;
  } else {
    const [inserted] = await sql`
      INSERT INTO inventory (
        account_id,
        main_sku,
        available_quantity,
        reserved_quantity,
        reorder_level,
        cost_price,
        location,
        created_at,
        updated_at
      ) VALUES (
        ${accountId},
        ${normSku},
        ${newQuantity},
        0,
        10,
        0,
        ${location},
        NOW(),
        NOW()
      )
      RETURNING *;
    `;
    inventoryRecord = inserted;
  }

  // Record movement
  const [movement] = await sql`
    INSERT INTO inventory_movements (
      account_id,
      inventory_id,
      main_sku,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      cost_price,
      supplier,
      batch_lot,
      location,
      reason,
      notes,
      created_at
    ) VALUES (
      ${accountId},
      ${inventoryRecord.id},
      ${normSku},
      ${adjustmentType},
      ${delta},
      ${previousQuantity},
      ${newQuantity},
      ${inventoryRecord.cost_price || 0},
      NULL,
      NULL,
      ${location},
      ${reason},
      ${payload.notes?.trim() || null},
      NOW()
    )
    RETURNING *;
  `;

  return { inventory: inventoryRecord, movement };
}

/**
 * 4. Get Movement History (Paginated / Filterable)
 */
export async function getInventoryMovements(
  accountId: string,
  options?: {
    mainSku?: string;
    movementType?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ movements: StockMovement[]; total: number }> {
  await ensureInventorySchema();

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  const skuFilter = options?.mainSku?.trim() ? `%${options.mainSku.trim().toLowerCase()}%` : null;
  const typeFilter = options?.movementType && options.movementType !== 'all' ? options.movementType : null;

  const [countRes] = await sql`
    SELECT COUNT(*)::int as total
    FROM inventory_movements im
    WHERE im.account_id = ${accountId}
      AND (${skuFilter}::text IS NULL OR LOWER(im.main_sku) LIKE ${skuFilter})
      AND (${typeFilter}::text IS NULL OR im.movement_type = ${typeFilter});
  `;

  const rows = await sql`
    SELECT 
      im.id,
      im.inventory_id,
      im.main_sku,
      im.movement_type,
      im.quantity,
      im.previous_quantity,
      im.new_quantity,
      im.cost_price,
      im.supplier,
      im.batch_lot,
      im.location,
      im.reason,
      im.notes,
      im.created_at,
      COALESCE(mp.name, ap.product_name, im.main_sku) as product_name
    FROM inventory_movements im
    LEFT JOIN main_products mp ON LOWER(mp.main_sku) = LOWER(im.main_sku) AND mp.account_id = im.account_id
    LEFT JOIN allproducts ap ON LOWER(ap.sku) = LOWER(im.main_sku) AND ap.account_id::text = im.account_id
    WHERE im.account_id = ${accountId}
      AND (${skuFilter}::text IS NULL OR LOWER(im.main_sku) LIKE ${skuFilter})
      AND (${typeFilter}::text IS NULL OR im.movement_type = ${typeFilter})
    ORDER BY im.created_at DESC
    LIMIT ${limit} OFFSET ${offset};
  `;

  return {
    movements: rows.map((r: any) => ({
      id: r.id,
      inventoryId: r.inventory_id,
      mainSku: r.main_sku,
      productName: r.product_name,
      movementType: r.movement_type,
      quantity: Number(r.quantity),
      previousQuantity: Number(r.previous_quantity),
      newQuantity: Number(r.new_quantity),
      costPrice: Number(r.cost_price || 0),
      supplier: r.supplier,
      batchLot: r.batch_lot,
      location: r.location,
      reason: r.reason,
      notes: r.notes,
      createdAt: r.created_at,
    })),
    total: countRes?.total || 0,
  };
}

export interface UpdateInventoryPayload {
  mainSku: string;
  availableQuantity: number;
  reservedQuantity?: number;
  reorderLevel?: number;
  costPrice?: number;
  location?: string;
  reason?: string;
  notes?: string;
}

/**
 * 5. Update/Edit Inventory Record (Safely updates stock, reorder, location, with movement audit)
 */
export async function updateInventoryRecord(
  accountId: string,
  payload: UpdateInventoryPayload
): Promise<{ inventory: any; movement?: any }> {
  await ensureInventorySchema();

  const normSku = payload.mainSku?.trim();
  if (!normSku) {
    throw new Error('Main SKU is required.');
  }

  const availableQuantity = Number(payload.availableQuantity);
  const reservedQuantity = payload.reservedQuantity !== undefined ? Number(payload.reservedQuantity) : 0;
  const reorderLevel = payload.reorderLevel !== undefined ? Number(payload.reorderLevel) : 10;
  const costPrice = payload.costPrice !== undefined ? Number(payload.costPrice) : undefined;
  const location = payload.location?.trim() || 'Main Warehouse';
  const reason = payload.reason?.trim() || 'Manual inventory edit';

  if (isNaN(availableQuantity) || availableQuantity < 0) {
    throw new Error('Available Quantity cannot be negative.');
  }
  if (isNaN(reservedQuantity) || reservedQuantity < 0) {
    throw new Error('Reserved Quantity cannot be negative.');
  }
  if (isNaN(reorderLevel) || reorderLevel < 0) {
    throw new Error('Reorder Level cannot be negative.');
  }
  if (costPrice !== undefined && (isNaN(costPrice) || costPrice < 0)) {
    throw new Error('Cost Price cannot be negative.');
  }

  // Fetch current inventory record
  const [existing] = await sql`
    SELECT id, available_quantity, reserved_quantity, reorder_level, cost_price, location
    FROM inventory
    WHERE account_id = ${accountId} AND LOWER(main_sku) = LOWER(${normSku});
  `;

  const previousAvailable = existing ? Number(existing.available_quantity || 0) : 0;
  const delta = availableQuantity - previousAvailable;
  const effectiveCost =
    costPrice !== undefined && costPrice >= 0
      ? costPrice
      : existing && Number(existing.cost_price) > 0
      ? Number(existing.cost_price)
      : 0;

  let inventoryRecord: any;

  if (existing) {
    const [updated] = await sql`
      UPDATE inventory
      SET 
        available_quantity = ${availableQuantity},
        reserved_quantity = ${reservedQuantity},
        reorder_level = ${reorderLevel},
        cost_price = ${effectiveCost},
        location = ${location},
        updated_at = NOW()
      WHERE id = ${existing.id}
      RETURNING *;
    `;
    inventoryRecord = updated;
  } else {
    const [inserted] = await sql`
      INSERT INTO inventory (
        account_id,
        main_sku,
        available_quantity,
        reserved_quantity,
        reorder_level,
        cost_price,
        location,
        created_at,
        updated_at
      ) VALUES (
        ${accountId},
        ${normSku},
        ${availableQuantity},
        ${reservedQuantity},
        ${reorderLevel},
        ${effectiveCost},
        ${location},
        NOW(),
        NOW()
      )
      RETURNING *;
    `;
    inventoryRecord = inserted;
  }

  // If available quantity changed, record a movement history entry
  let movement: any = null;
  if (delta !== 0) {
    const [m] = await sql`
      INSERT INTO inventory_movements (
        account_id,
        inventory_id,
        main_sku,
        movement_type,
        quantity,
        previous_quantity,
        new_quantity,
        cost_price,
        supplier,
        batch_lot,
        location,
        reason,
        notes,
        created_at
      ) VALUES (
        ${accountId},
        ${inventoryRecord.id},
        ${normSku},
        'Adjustment',
        ${delta},
        ${previousAvailable},
        ${availableQuantity},
        ${effectiveCost},
        NULL,
        NULL,
        ${location},
        ${reason},
        ${payload.notes?.trim() || null},
        NOW()
      )
      RETURNING *;
    `;
    movement = m;
  }

  return { inventory: inventoryRecord, movement };
}

/**
 * 6. Delete Inventory Record (Deletes only the inventory row; product catalog in Products is preserved)
 */
export async function deleteInventoryRecord(
  accountId: string,
  mainSku: string
): Promise<{ success: boolean; deletedSku: string }> {
  await ensureInventorySchema();

  const normSku = mainSku?.trim();
  if (!normSku) {
    throw new Error('Main SKU is required.');
  }

  // Delete movements and inventory record for this account and SKU only
  await sql`
    DELETE FROM inventory_movements
    WHERE account_id = ${accountId} AND LOWER(main_sku) = LOWER(${normSku});
  `;

  await sql`
    DELETE FROM inventory
    WHERE account_id = ${accountId} AND LOWER(main_sku) = LOWER(${normSku});
  `;

  return { success: true, deletedSku: normSku };
}

