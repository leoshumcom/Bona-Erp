-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "real_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "status" TEXT NOT NULL DEFAULT 'active',
    "department_id" TEXT,
    "company_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "api_base" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '北美',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "taxMode" TEXT NOT NULL DEFAULT 'excl',
    "token_info" TEXT,
    "store_type" TEXT NOT NULL DEFAULT 'self',
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "stores_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "unit_of_measures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "product_number" TEXT,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "description" TEXT,
    "material_type" TEXT NOT NULL DEFAULT 'FINISHED_GOOD',
    "unit_of_measure_id" TEXT NOT NULL,
    "category" TEXT,
    "brand" TEXT,
    "image_url" TEXT,
    "weight" REAL,
    "dimensions" TEXT,
    "customs_code" TEXT,
    "standard_cost" REAL,
    "current_cost" REAL,
    "lead_time_days" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "products_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_of_measures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "store_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "store_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "store_sku" TEXT,
    "asin" TEXT,
    "listing_url" TEXT,
    "current_price" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "store_products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "store_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplier_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "address" TEXT,
    "payment_terms" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "molds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mold_code" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "mold_cost" REAL NOT NULL,
    "lifespan" INTEGER NOT NULL,
    "produced_count" INTEGER NOT NULL DEFAULT 0,
    "depreciation_method" TEXT NOT NULL DEFAULT 'per_unit',
    "start_date" DATETIME NOT NULL,
    "scrap_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "molds_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mold_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mold_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "expense_date" DATETIME NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mold_expenses_mold_id_fkey" FOREIGN KEY ("mold_id") REFERENCES "molds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mold_depreciations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mold_id" TEXT NOT NULL,
    "production_order_id" TEXT,
    "amount" REAL NOT NULL,
    "depreciation_date" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mold_depreciations_mold_id_fkey" FOREIGN KEY ("mold_id") REFERENCES "molds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bill_of_materials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bom_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "base_quantity" REAL NOT NULL DEFAULT 1,
    "created_by_id" TEXT NOT NULL,
    "approved_at" DATETIME,
    "activated_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "bill_of_materials_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bill_of_material_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bom_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "material_id" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit_of_measure_id" TEXT NOT NULL,
    "scrap_percent" REAL NOT NULL DEFAULT 0,
    "is_key_material" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bill_of_material_lines_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bill_of_materials" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bill_of_material_lines_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bill_of_material_lines_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_of_measures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_centers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "cost_per_hour" REAL,
    "capacity_per_day" REAL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "product_id" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit_of_measure_id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "planned_start_date" DATETIME,
    "planned_end_date" DATETIME,
    "released_at" DATETIME,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "closed_at" DATETIME,
    "completed_quantity" REAL NOT NULL DEFAULT 0,
    "scrapped_quantity" REAL NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "released_by_id" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "production_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_orders_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_of_measures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_orders_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bill_of_materials" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_orders_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_order_components" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "production_order_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "material_id" TEXT NOT NULL,
    "unit_of_measure_id" TEXT NOT NULL,
    "planned_quantity" REAL NOT NULL,
    "issued_quantity" REAL NOT NULL DEFAULT 0,
    "scrapped_quantity" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "production_order_components_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "production_order_components_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_order_components_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_of_measures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_order_operations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "production_order_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "work_center_id" TEXT NOT NULL,
    "planned_hours" REAL NOT NULL DEFAULT 0,
    "actual_hours" REAL NOT NULL DEFAULT 0,
    "labor_cost" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "notes" TEXT,
    CONSTRAINT "production_order_operations_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "production_order_operations_work_center_id_fkey" FOREIGN KEY ("work_center_id") REFERENCES "work_centers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_costs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "production_order_id" TEXT NOT NULL,
    "cost_type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_costs_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "factory_fixed_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expense_type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "expense_month" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "storage_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_ledgers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "movement_type" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "storage_location_id" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit_of_measure_id" TEXT NOT NULL,
    "unit_cost" REAL,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "posted_by_id" TEXT NOT NULL,
    "posted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "inventory_ledgers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_ledgers_storage_location_id_fkey" FOREIGN KEY ("storage_location_id") REFERENCES "storage_locations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_ledgers_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_of_measures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_ledgers_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "storage_location_id" TEXT NOT NULL,
    "quantity_on_hand" REAL NOT NULL DEFAULT 0,
    "total_cost" REAL NOT NULL DEFAULT 0,
    "unit_of_measure_id" TEXT NOT NULL,
    "last_movement_at" DATETIME,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_balances_storage_location_id_fkey" FOREIGN KEY ("storage_location_id") REFERENCES "storage_locations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_balances_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_of_measures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "material_lots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lot_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity_received" REAL NOT NULL,
    "quantity_remaining" REAL NOT NULL,
    "unit_of_measure_id" TEXT NOT NULL,
    "unit_cost" REAL NOT NULL,
    "storage_location_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_ref_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "received_at" DATETIME NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "material_lots_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_of_measures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "material_lots_storage_location_id_fkey" FOREIGN KEY ("storage_location_id") REFERENCES "storage_locations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "material_lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "material_lot_consumptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "production_order_component_id" TEXT NOT NULL,
    "material_lot_id" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "posted_by_id" TEXT NOT NULL,
    "posted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "material_lot_consumptions_production_order_component_id_fkey" FOREIGN KEY ("production_order_component_id") REFERENCES "production_order_components" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "material_lot_consumptions_material_lot_id_fkey" FOREIGN KEY ("material_lot_id") REFERENCES "material_lots" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "material_lot_consumptions_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "finished_good_lots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lot_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit_of_measure_id" TEXT NOT NULL,
    "storage_location_id" TEXT NOT NULL,
    "received_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "finished_good_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "finished_good_lots_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "finished_good_lots_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_of_measures" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "finished_good_lots_storage_location_id_fkey" FOREIGN KEY ("storage_location_id") REFERENCES "storage_locations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "warehouse_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warehouse_id" TEXT,
    "expense_type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "expense_month" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_number" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "platform_order_id" TEXT,
    "customer_name" TEXT,
    "customer_email" TEXT,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "shipping_amount" REAL NOT NULL DEFAULT 0,
    "tax_amount" REAL NOT NULL DEFAULT 0,
    "total_amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "payment_status" TEXT NOT NULL DEFAULT 'PAID',
    "shipping_status" TEXT,
    "warehouse_id" TEXT,
    "ordered_at" DATETIME NOT NULL,
    "shipped_at" DATETIME,
    "delivered_at" DATETIME,
    "labels" TEXT,
    "internal_note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" REAL NOT NULL,
    "total_amount" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_fees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "fee_type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_fees_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_profits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "sales_amount" REAL NOT NULL,
    "refund_amount" REAL NOT NULL DEFAULT 0,
    "product_cost" REAL NOT NULL DEFAULT 0,
    "warehouse_cost" REAL NOT NULL DEFAULT 0,
    "platform_fee" REAL NOT NULL DEFAULT 0,
    "ad_fee" REAL NOT NULL DEFAULT 0,
    "logistics_fee" REAL NOT NULL DEFAULT 0,
    "aftersales_fee" REAL NOT NULL DEFAULT 0,
    "tax_fee" REAL NOT NULL DEFAULT 0,
    "gross_profit" REAL NOT NULL DEFAULT 0,
    "net_profit" REAL NOT NULL DEFAULT 0,
    "profit_margin" REAL NOT NULL DEFAULT 0,
    "calculated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "order_profits_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "store_id" TEXT NOT NULL,
    "platform_campaign_id" TEXT,
    "campaign_name" TEXT NOT NULL,
    "campaign_type" TEXT NOT NULL,
    "spend" REAL NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "sales" REAL NOT NULL DEFAULT 0,
    "acos" REAL,
    "roas" REAL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ad_campaigns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "after_sales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'REFUND',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "refund_amount" REAL,
    "logistics_fee" REAL,
    "compensation" REAL,
    "loss_amount" REAL,
    "reason" TEXT,
    "resolution" TEXT,
    "resolved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "after_sales_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "logistics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "tracking_number" TEXT,
    "carrier" TEXT,
    "channel" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'FIRST_MILE',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "first_mile_fee" REAL NOT NULL DEFAULT 0,
    "international_fee" REAL NOT NULL DEFAULT 0,
    "last_mile_fee" REAL NOT NULL DEFAULT 0,
    "total_fee" REAL NOT NULL DEFAULT 0,
    "estimated_delivery" DATETIME,
    "actual_delivery" DATETIME,
    "exception_note" TEXT,
    "shipped_at" DATETIME,
    "delivered_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "logistics_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "before_state" TEXT,
    "after_state" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_name_key" ON "platforms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_code_key" ON "platforms"("code");

-- CreateIndex
CREATE UNIQUE INDEX "unit_of_measures_code_key" ON "unit_of_measures"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_product_number_key" ON "products"("product_number");

-- CreateIndex
CREATE INDEX "products_material_type_idx" ON "products"("material_type");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE UNIQUE INDEX "store_products_store_id_product_id_key" ON "store_products"("store_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplier_number_key" ON "suppliers"("supplier_number");

-- CreateIndex
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "molds_mold_code_key" ON "molds"("mold_code");

-- CreateIndex
CREATE UNIQUE INDEX "bill_of_materials_bom_number_key" ON "bill_of_materials"("bom_number");

-- CreateIndex
CREATE INDEX "bill_of_materials_product_id_status_idx" ON "bill_of_materials"("product_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bill_of_materials_product_id_version_key" ON "bill_of_materials"("product_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "bill_of_material_lines_bom_id_line_number_key" ON "bill_of_material_lines"("bom_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "work_centers_code_key" ON "work_centers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_order_number_key" ON "production_orders"("order_number");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_orders_product_id_idx" ON "production_orders"("product_id");

-- CreateIndex
CREATE INDEX "production_order_components_material_id_idx" ON "production_order_components"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_order_components_production_order_id_line_number_key" ON "production_order_components"("production_order_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "production_order_operations_production_order_id_sequence_key" ON "production_order_operations"("production_order_id", "sequence");

-- CreateIndex
CREATE INDEX "factory_fixed_expenses_expense_month_idx" ON "factory_fixed_expenses"("expense_month");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "storage_locations_warehouse_id_code_key" ON "storage_locations"("warehouse_id", "code");

-- CreateIndex
CREATE INDEX "inventory_ledgers_product_id_idx" ON "inventory_ledgers"("product_id");

-- CreateIndex
CREATE INDEX "inventory_ledgers_storage_location_id_idx" ON "inventory_ledgers"("storage_location_id");

-- CreateIndex
CREATE INDEX "inventory_ledgers_product_id_storage_location_id_idx" ON "inventory_ledgers"("product_id", "storage_location_id");

-- CreateIndex
CREATE INDEX "inventory_ledgers_reference_type_reference_id_idx" ON "inventory_ledgers"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "inventory_ledgers_posted_at_idx" ON "inventory_ledgers"("posted_at");

-- CreateIndex
CREATE INDEX "inventory_balances_product_id_idx" ON "inventory_balances"("product_id");

-- CreateIndex
CREATE INDEX "inventory_balances_storage_location_id_idx" ON "inventory_balances"("storage_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_product_id_storage_location_id_key" ON "inventory_balances"("product_id", "storage_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_lots_lot_number_key" ON "material_lots"("lot_number");

-- CreateIndex
CREATE INDEX "material_lots_product_id_quantity_remaining_idx" ON "material_lots"("product_id", "quantity_remaining");

-- CreateIndex
CREATE INDEX "material_lots_product_id_storage_location_id_quantity_remaining_idx" ON "material_lots"("product_id", "storage_location_id", "quantity_remaining");

-- CreateIndex
CREATE INDEX "material_lot_consumptions_production_order_component_id_idx" ON "material_lot_consumptions"("production_order_component_id");

-- CreateIndex
CREATE INDEX "material_lot_consumptions_material_lot_id_idx" ON "material_lot_consumptions"("material_lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "finished_good_lots_lot_number_key" ON "finished_good_lots"("lot_number");

-- CreateIndex
CREATE INDEX "finished_good_lots_production_order_id_idx" ON "finished_good_lots"("production_order_id");

-- CreateIndex
CREATE INDEX "finished_good_lots_product_id_idx" ON "finished_good_lots"("product_id");

-- CreateIndex
CREATE INDEX "warehouse_expenses_expense_month_idx" ON "warehouse_expenses"("expense_month");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_store_id_idx" ON "orders"("store_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_ordered_at_idx" ON "orders"("ordered_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_profits_order_id_key" ON "order_profits"("order_id");

-- CreateIndex
CREATE INDEX "ad_campaigns_store_id_idx" ON "ad_campaigns"("store_id");

-- CreateIndex
CREATE INDEX "ad_campaigns_start_date_idx" ON "ad_campaigns"("start_date");

-- CreateIndex
CREATE INDEX "after_sales_order_id_idx" ON "after_sales"("order_id");

-- CreateIndex
CREATE INDEX "after_sales_status_idx" ON "after_sales"("status");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_order_id_key" ON "logistics"("order_id");

-- CreateIndex
CREATE INDEX "logistics_status_idx" ON "logistics"("status");

-- CreateIndex
CREATE INDEX "logistics_carrier_idx" ON "logistics"("carrier");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

