# 🗄️ DEPLOY QOLAE_READERS DATABASE

**Server**: 91.99.184.77 (Hetzner Live Server)
**PostgreSQL Port**: 5432
**Database Name**: qolae_readers

---

## 📋 DEPLOYMENT STEPS

### **Step 1: SSH into Live Server**
```bash
ssh root@91.99.184.77
```

### **Step 2: Create Database & User**
```bash
# Connect to PostgreSQL as postgres user
sudo -u postgres psql

# Run these SQL commands:
```

```sql
-- Create database
CREATE DATABASE qolae_readers;

-- Create user
CREATE USER readers_user WITH PASSWORD 'your-secure-password-here';

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE qolae_readers TO readers_user;

-- Connect to the new database
\c qolae_readers;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO readers_user;

-- Exit psql
\q
```

### **Step 3: Upload Schema File**
```bash
# From your local machine (Mac):
scp /Users/lizchukwu_1/QOLAE-Online-Portal/QOLAE-Readers-Dashboard/database/setup_qolae_readers.sql root@91.99.184.77:/tmp/

# Back on the server:
sudo -u postgres psql -d qolae_readers -f /tmp/setup_qolae_readers.sql
```

### **Step 4: Verify Tables Created**
```bash
sudo -u postgres psql -d qolae_readers

# List all tables
\dt

# Expected output:
# readers
# reader_assignments
# reader_activity_log
# reader_nda_versions

# Check readers table structure
\d readers

# Exit
\q
```

### **Step 5: Test Database Connection**
```bash
# Test connection with readers_user
PGPASSWORD='your-password-here' psql -U readers_user -d qolae_readers -h localhost -c "SELECT version();"
```

---

## ✅ VERIFICATION

**Success indicators**:
- ✅ Database `qolae_readers` exists
- ✅ User `readers_user` can connect
- ✅ 4 tables created (readers, reader_assignments, reader_activity_log, reader_nda_versions)
- ✅ Triggers and functions created
- ✅ Initial NDA version inserted

---

## 🔐 UPDATE .ENV FILE

**Location on server**: `/var/www/casemanagers.qolae.com/.env`

```env
READERS_DATABASE_URL=postgresql://readers_user:your-secure-password-here@localhost:5432/qolae_readers
```

---

**Ready for PM2 deployment!** 🚀
