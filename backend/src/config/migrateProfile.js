/**
 * Adds profile + shared-event columns if they don't exist.
 * Runs automatically on server startup — safe to run multiple times.
 */
const { getPool } = require('./db');

const migrateProfile = async () => {
  try {
    const pool = await getPool();

    // DC_Users profile columns
    const userCols = [
      { table: 'DC_Users', name: 'FirstName',    def: 'NVARCHAR(100) NULL' },
      { table: 'DC_Users', name: 'LastName',     def: 'NVARCHAR(100) NULL' },
      { table: 'DC_Users', name: 'Phone',        def: 'NVARCHAR(30) NULL' },
      { table: 'DC_Users', name: 'Bio',          def: 'NVARCHAR(500) NULL' },
      { table: 'DC_Users', name: 'Location',     def: 'NVARCHAR(200) NULL' },
      { table: 'DC_Users', name: 'Department',   def: 'NVARCHAR(100) NULL' },
      { table: 'DC_Users', name: 'AvatarColor',  def: "NVARCHAR(20) NULL DEFAULT '#1e40af'" },
      { table: 'DC_Users', name: 'TwoFAEnabled', def: 'BIT NOT NULL DEFAULT 0' },
      { table: 'DC_Users', name: 'TwoFASecret',  def: 'NVARCHAR(100) NULL' },
      { table: 'DC_Users', name: 'IsActive',     def: 'BIT NOT NULL DEFAULT 1' },
      { table: 'DC_Users', name: 'LastLoginAt',  def: 'DATETIME2 NULL' },
      { table: 'DC_Users', name: 'UpdatedAt',    def: 'DATETIME2 NULL DEFAULT GETUTCDATE()' },
      { table: 'DC_Users', name: 'AvatarPhoto',  def: 'NVARCHAR(MAX) NULL' },

      // Shared meeting/event support — DirectorIds stores JSON array of director IDs
      { table: 'DC_Meetings', name: 'DirectorIds', def: 'NVARCHAR(500) NULL' },
      { table: 'DC_Meetings', name: 'IsShared',    def: 'BIT NOT NULL DEFAULT 0' },
      { table: 'DC_Events',   name: 'DirectorIds', def: 'NVARCHAR(500) NULL' },
      { table: 'DC_Events',   name: 'IsShared',    def: 'BIT NOT NULL DEFAULT 0' },
      { table: 'DC_Tasks',    name: 'ExternalTaskId', def: 'NVARCHAR(250) NULL' },
      { table: 'DC_Tasks',    name: 'Source',         def: "NVARCHAR(20) NULL DEFAULT 'manual'" },
    ];

    for (const col of userCols) {
      try {
        await pool.request().query(
          `IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${col.table}' AND COLUMN_NAME = '${col.name}'
          )
          ALTER TABLE ${col.table} ADD ${col.name} ${col.def}`
        );
      } catch (e) {
        // Already exists — safe to ignore
      }
    }

    console.log('✅ Profile & shared-event columns ready');

    // Ensure DC_TeamsTokens table exists (supports all users, not just directors)
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_TeamsTokens' AND xtype='U')
        CREATE TABLE DC_TeamsTokens (
          DirectorId   NVARCHAR(36)  NOT NULL PRIMARY KEY,
          AccessToken  NVARCHAR(MAX) NOT NULL,
          RefreshToken NVARCHAR(MAX) NULL,
          ExpiresAt    BIGINT        NOT NULL,
          MsUserEmail  NVARCHAR(150) NULL,
          UpdatedAt    DATETIME2     NOT NULL DEFAULT GETUTCDATE()
        )
      `);
    } catch (e) { /* already exists */ }

    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OutlookConnections' AND xtype='U')
        CREATE TABLE OutlookConnections (
          Id                   NVARCHAR(36)  NOT NULL PRIMARY KEY,
          DirectorId           NVARCHAR(36)  NOT NULL UNIQUE,
          MicrosoftUserId      NVARCHAR(200) NULL,
          MsUserEmail          NVARCHAR(150) NULL,
          AccessTokenEncrypted NVARCHAR(MAX) NULL,
          RefreshTokenEncrypted NVARCHAR(MAX) NULL,
          TokenExpiry          BIGINT        NULL,
          ConnectedAt          DATETIME2     NULL,
          LastSync             DATETIME2     NULL,
          CreatedAt            DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
          UpdatedAt            DATETIME2     NOT NULL DEFAULT GETUTCDATE()
        )
      `);
    } catch (e) { /* already exists */ }

    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OutlookCalendarEvents' AND xtype='U')
        CREATE TABLE OutlookCalendarEvents (
          Id               NVARCHAR(36)  NOT NULL PRIMARY KEY,
          DirectorId       NVARCHAR(36)  NOT NULL,
          OutlookResourceId NVARCHAR(200) NOT NULL,
          Subject          NVARCHAR(250) NOT NULL,
          Body             NVARCHAR(MAX) NULL,
          StartDateTime    DATETIME2     NOT NULL,
          EndDateTime      DATETIME2     NULL,
          IsAllDay         BIT           NOT NULL DEFAULT 0,
          Location         NVARCHAR(300) NULL,
          Organizer        NVARCHAR(200) NULL,
          Attendees        NVARCHAR(MAX) NULL,
          RawData          NVARCHAR(MAX) NULL,
          SyncedAt         DATETIME2     NOT NULL DEFAULT GETUTCDATE()
        )
      `);
    } catch (e) { /* already exists */ }

    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OutlookEmails' AND xtype='U')
        CREATE TABLE OutlookEmails (
          Id               NVARCHAR(36)  NOT NULL PRIMARY KEY,
          DirectorId       NVARCHAR(36)  NOT NULL,
          OutlookResourceId NVARCHAR(200) NOT NULL,
          Subject          NVARCHAR(250) NOT NULL,
          FromAddress      NVARCHAR(200) NULL,
          FromName         NVARCHAR(200) NULL,
          ReceivedAt       DATETIME2     NULL,
          Preview          NVARCHAR(MAX) NULL,
          IsRead           BIT           NOT NULL DEFAULT 0,
          Importance       NVARCHAR(50)  NOT NULL DEFAULT 'normal',
          RawData          NVARCHAR(MAX) NULL,
          SyncedAt         DATETIME2     NOT NULL DEFAULT GETUTCDATE()
        )
      `);
    } catch (e) { /* already exists */ }

    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OutlookTasks' AND xtype='U')
        CREATE TABLE OutlookTasks (
          Id               NVARCHAR(36)  NOT NULL PRIMARY KEY,
          DirectorId       NVARCHAR(36)  NOT NULL,
          OutlookResourceId NVARCHAR(200) NOT NULL,
          Title            NVARCHAR(300) NOT NULL,
          ListName         NVARCHAR(200) NULL,
          Status           NVARCHAR(100) NOT NULL DEFAULT 'notStarted',
          Importance       NVARCHAR(50)  NOT NULL DEFAULT 'normal',
          DueDate          DATETIME2     NULL,
          ReminderDate     DATETIME2     NULL,
          Body             NVARCHAR(MAX) NULL,
          RawData          NVARCHAR(MAX) NULL,
          SyncedAt         DATETIME2     NOT NULL DEFAULT GETUTCDATE()
        )
      `);
    } catch (e) { /* already exists */ }

    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OutlookReminders' AND xtype='U')
        CREATE TABLE OutlookReminders (
          Id               NVARCHAR(36)  NOT NULL PRIMARY KEY,
          DirectorId       NVARCHAR(36)  NOT NULL,
          OutlookResourceId NVARCHAR(200) NOT NULL,
          Title            NVARCHAR(300) NOT NULL,
          ListName         NVARCHAR(200) NULL,
          DueDate          DATETIME2     NULL,
          ReminderDate     DATETIME2     NULL,
          Body             NVARCHAR(MAX) NULL,
          RawData          NVARCHAR(MAX) NULL,
          SyncedAt         DATETIME2     NOT NULL DEFAULT GETUTCDATE()
        )
      `);
    } catch (e) { /* already exists */ }

    // Add password reset columns if they don't exist
    try {
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'DC_Users' AND COLUMN_NAME = 'PasswordResetToken'
        )
        ALTER TABLE DC_Users ADD PasswordResetToken NVARCHAR(200) NULL
      `);
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'DC_Users' AND COLUMN_NAME = 'PasswordResetExpiry'
        )
        ALTER TABLE DC_Users ADD PasswordResetExpiry DATETIME2 NULL
      `);
    } catch (e) { /* already exists */ }

  } catch (err) {
    console.error('Migration warning:', err.message);
  }
};

module.exports = migrateProfile;
