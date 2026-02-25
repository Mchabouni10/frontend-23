/**
 * Migration Script: Fix Deposit Payment Dates
 * 
 * This script migrates projects that have a depositAmount but no corresponding
 * deposit payment object in the settings.payments array.
 * 
 * Place this file in the backend-23 directory and run: node migrate-deposits.js
 */

// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');
const Project = require('./models/project');

// MongoDB connection string from .env
const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGO_URI not found in environment variables');
  console.error('   Make sure .env file exists and contains MONGO_URI');
  process.exit(1);
}

console.log('🔧 Starting deposit payment migration...\n');

// Connect to MongoDB
async function connect() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const db = mongoose.connection;
    console.log(`✅ Connected to ${db.name} at ${db.host}\n`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Main migration function
async function migrateDepositDates() {
  try {
    // Find all projects
    const projects = await Project.find({});
    console.log(`📊 Found ${projects.length} total projects\n`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const project of projects) {
      try {
        let needsUpdate = false;
        
        // Check if project has a depositAmount in paymentDetails
        const depositAmount = project.paymentDetails?.depositAmount || 0;
        
        if (depositAmount > 0) {
          // Check if there's already a deposit payment in settings.payments
          const hasDepositPayment = project.settings?.payments?.some(p => p.method === 'Deposit');
          
          if (!hasDepositPayment) {
            console.log(`🔧 Migrating project: ${project._id}`);
            console.log(`   Customer: ${project.customerInfo?.firstName} ${project.customerInfo?.lastName}`);
            console.log(`   Project: ${project.customerInfo?.projectName}`);
            console.log(`   Deposit Amount: $${depositAmount}`);
            
            // Initialize payments array if it doesn't exist
            if (!project.settings) {
              project.settings = {};
            }
            if (!project.settings.payments) {
              project.settings.payments = [];
            }
            
            // Create deposit payment object
            // Use the project start date as the deposit date (or creation date as fallback)
            const depositDate = project.customerInfo?.startDate || project.createdAt || new Date();
            
            const depositPayment = {
              date: depositDate,
              amount: depositAmount,
              method: 'Deposit',
              note: 'Initial deposit (migrated)',
              isPaid: true,
              status: 'Paid'
            };
            
            // Add deposit payment to the beginning of the array
            project.settings.payments.unshift(depositPayment);
            
            console.log(`   ✅ Added deposit payment with date: ${depositDate.toISOString().split('T')[0]}`);
            
            needsUpdate = true;
          } else {
            // Deposit payment exists, but check if it has a date
            const depositPayment = project.settings.payments.find(p => p.method === 'Deposit');
            
            if (!depositPayment.date) {
              console.log(`🔧 Fixing deposit date for project: ${project._id}`);
              console.log(`   Customer: ${project.customerInfo?.firstName} ${project.customerInfo?.lastName}`);
              depositPayment.date = project.customerInfo?.startDate || project.createdAt || new Date();
              console.log(`   ✅ Set deposit date to: ${depositPayment.date.toISOString().split('T')[0]}`);
              needsUpdate = true;
            }
          }
        }
        
        // Save if changes were made
        if (needsUpdate) {
          await project.save({ validateBeforeSave: false });
          migratedCount++;
          console.log(`   💾 Project saved successfully\n`);
        } else {
          skippedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing project ${project._id}:`, error.message);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total projects: ${projects.length}`);
    console.log(`✅ Migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (already correct): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');
    
    if (migratedCount > 0) {
      console.log('✅ Migration completed successfully!');
      console.log('   The deposit dates should now appear in the Payment Tracking UI.');
    } else if (skippedCount === projects.length) {
      console.log('✅ All projects already have correct deposit payment data.');
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

// Run the migration
async function run() {
  try {
    await connect();
    await migrateDepositDates();
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Execute
run();
