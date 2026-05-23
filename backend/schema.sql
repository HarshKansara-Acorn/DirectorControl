-- DirectorControl Schema for Azure SQL (BCDWsqldatabase)
-- Safe to run multiple times - uses IF NOT EXISTS guards

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_Users' AND xtype='U')
CREATE TABLE DC_Users (
  Id        NVARCHAR(36)  NOT NULL PRIMARY KEY,
  Name      NVARCHAR(100) NOT NULL,
  Email     NVARCHAR(150) NOT NULL UNIQUE,
  Password  NVARCHAR(255) NOT NULL,
  Role      NVARCHAR(20)  NOT NULL DEFAULT 'director',
  Title     NVARCHAR(100) NULL,
  Avatar    NVARCHAR(10)  NULL,
  CreatedAt DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_Tasks' AND xtype='U')
CREATE TABLE DC_Tasks (
  Id          NVARCHAR(36)  NOT NULL PRIMARY KEY,
  Title       NVARCHAR(200) NOT NULL,
  Description NVARCHAR(MAX) NULL,
  Priority    NVARCHAR(20)  NOT NULL DEFAULT 'medium',
  Status      NVARCHAR(20)  NOT NULL DEFAULT 'todo',
  AssignedTo  NVARCHAR(36)  NOT NULL,
  CreatedBy   NVARCHAR(36)  NOT NULL,
  DueDate     DATE          NULL,
  Tags        NVARCHAR(500) NULL,
  CreatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
  UpdatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_Reminders' AND xtype='U')
CREATE TABLE DC_Reminders (
  Id          NVARCHAR(36)  NOT NULL PRIMARY KEY,
  Title       NVARCHAR(200) NOT NULL,
  Description NVARCHAR(MAX) NULL,
  DirectorId  NVARCHAR(36)  NOT NULL,
  DueDate     DATE          NULL,
  Priority    NVARCHAR(20)  NOT NULL DEFAULT 'medium',
  IsActive    BIT           NOT NULL DEFAULT 1,
  CreatedBy   NVARCHAR(36)  NOT NULL,
  CreatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_Approvals' AND xtype='U')
CREATE TABLE DC_Approvals (
  Id          NVARCHAR(36)  NOT NULL PRIMARY KEY,
  Type        NVARCHAR(50)  NOT NULL DEFAULT 'general',
  Title       NVARCHAR(200) NOT NULL,
  Description NVARCHAR(MAX) NULL,
  FromName    NVARCHAR(100) NULL,
  FromEmail   NVARCHAR(150) NULL,
  DirectorId  NVARCHAR(36)  NOT NULL,
  Priority    NVARCHAR(20)  NOT NULL DEFAULT 'normal',
  DueDate     DATE          NULL,
  Status      NVARCHAR(20)  NOT NULL DEFAULT 'pending',
  Remarks     NVARCHAR(MAX) NULL,
  ActionBy    NVARCHAR(36)  NULL,
  ActionAt    DATETIME2     NULL,
  CreatedBy   NVARCHAR(36)  NOT NULL,
  CreatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_Meetings' AND xtype='U')
CREATE TABLE DC_Meetings (
  Id          NVARCHAR(36)  NOT NULL PRIMARY KEY,
  Title       NVARCHAR(200) NOT NULL,
  Description NVARCHAR(MAX) NULL,
  DirectorId  NVARCHAR(36)  NOT NULL,
  MeetingDate DATE          NOT NULL,
  MeetingTime NVARCHAR(10)  NULL,
  Duration    INT           NULL DEFAULT 60,
  Location    NVARCHAR(200) NULL,
  Attendees   NVARCHAR(MAX) NULL,
  CreatedBy   NVARCHAR(36)  NOT NULL,
  CreatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_UrgentEmails' AND xtype='U')
CREATE TABLE DC_UrgentEmails (
  Id        NVARCHAR(36)  NOT NULL PRIMARY KEY,
  Subject   NVARCHAR(300) NOT NULL,
  FromEmail NVARCHAR(150) NULL,
  FromName  NVARCHAR(100) NULL,
  DirectorId NVARCHAR(36) NOT NULL,
  Preview   NVARCHAR(MAX) NULL,
  Priority  NVARCHAR(20)  NOT NULL DEFAULT 'urgent',
  IsRead    BIT           NOT NULL DEFAULT 0,
  CreatedBy NVARCHAR(36)  NOT NULL,
  CreatedAt DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_Travel' AND xtype='U')
CREATE TABLE DC_Travel (
  Id            NVARCHAR(36)  NOT NULL PRIMARY KEY,
  Destination   NVARCHAR(200) NOT NULL,
  Purpose       NVARCHAR(300) NULL,
  DirectorId    NVARCHAR(36)  NOT NULL,
  DepartureDate DATE          NOT NULL,
  ReturnDate    DATE          NULL,
  Status        NVARCHAR(20)  NOT NULL DEFAULT 'upcoming',
  Notes         NVARCHAR(MAX) NULL,
  CreatedBy     NVARCHAR(36)  NOT NULL,
  CreatedAt     DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_Documents' AND xtype='U')
CREATE TABLE DC_Documents (
  Id          NVARCHAR(36)  NOT NULL PRIMARY KEY,
  Title       NVARCHAR(200) NOT NULL,
  Description NVARCHAR(MAX) NULL,
  Category    NVARCHAR(50)  NOT NULL DEFAULT 'General',
  DirectorId  NVARCHAR(36)  NOT NULL,
  FileUrl     NVARCHAR(500) NULL,
  FileName    NVARCHAR(300) NULL,
  FileSize    NVARCHAR(50)  NULL,
  FileType    NVARCHAR(20)  NULL DEFAULT 'pdf',
  Status      NVARCHAR(20)  NOT NULL DEFAULT 'active',
  ExpiryDate  DATE          NULL,
  Tags        NVARCHAR(500) NULL,
  CreatedBy   NVARCHAR(36)  NOT NULL,
  CreatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_Bills' AND xtype='U')
CREATE TABLE DC_Bills (
  Id            NVARCHAR(36)  NOT NULL PRIMARY KEY,
  Title         NVARCHAR(200) NOT NULL,
  Vendor        NVARCHAR(200) NULL,
  Category      NVARCHAR(50)  NOT NULL DEFAULT 'General',
  DirectorId    NVARCHAR(36)  NOT NULL,
  Amount        FLOAT         NOT NULL DEFAULT 0,
  Currency      NVARCHAR(5)   NOT NULL DEFAULT '₹',
  DueDate       DATE          NULL,
  Status        NVARCHAR(20)  NOT NULL DEFAULT 'pending',
  InvoiceNumber NVARCHAR(100) NULL,
  Notes         NVARCHAR(MAX) NULL,
  PaidDate      DATE          NULL,
  CreatedBy     NVARCHAR(36)  NOT NULL,
  CreatedAt     DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_Assets' AND xtype='U')
CREATE TABLE DC_Assets (
  Id             NVARCHAR(36)  NOT NULL PRIMARY KEY,
  Name           NVARCHAR(200) NOT NULL,
  Description    NVARCHAR(MAX) NULL,
  Category       NVARCHAR(50)  NOT NULL DEFAULT 'General',
  DirectorId     NVARCHAR(36)  NOT NULL,
  SerialNumber   NVARCHAR(100) NULL,
  PurchaseDate   DATE          NULL,
  PurchaseValue  FLOAT         NULL DEFAULT 0,
  CurrentValue   FLOAT         NULL DEFAULT 0,
  Currency       NVARCHAR(5)   NOT NULL DEFAULT '₹',
  Status         NVARCHAR(20)  NOT NULL DEFAULT 'active',
  Location       NVARCHAR(200) NULL,
  WarrantyExpiry DATE          NULL,
  AssignedTo     NVARCHAR(100) NULL,
  CreatedBy      NVARCHAR(36)  NOT NULL,
  CreatedAt      DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_Events' AND xtype='U')
CREATE TABLE DC_Events (
  Id          NVARCHAR(36)  NOT NULL PRIMARY KEY,
  Title       NVARCHAR(200) NOT NULL,
  Description NVARCHAR(MAX) NULL,
  Type        NVARCHAR(50)  NOT NULL DEFAULT 'meeting',
  DirectorId  NVARCHAR(36)  NOT NULL,
  StartDate   DATE          NOT NULL,
  EndDate     DATE          NULL,
  StartTime   NVARCHAR(10)  NULL,
  EndTime     NVARCHAR(10)  NULL,
  Location    NVARCHAR(300) NULL,
  Attendees   NVARCHAR(MAX) NULL,
  IsAllDay    BIT           NOT NULL DEFAULT 0,
  Priority    NVARCHAR(20)  NOT NULL DEFAULT 'medium',
  Status      NVARCHAR(20)  NOT NULL DEFAULT 'upcoming',
  Notes       NVARCHAR(MAX) NULL,
  TeamsId     NVARCHAR(200) NULL,
  JoinUrl     NVARCHAR(500) NULL,
  Source      NVARCHAR(20)  NULL DEFAULT 'manual',
  CreatedBy   NVARCHAR(36)  NOT NULL,
  CreatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_TeamsTokens' AND xtype='U')
CREATE TABLE DC_TeamsTokens (
  DirectorId   NVARCHAR(36)  NOT NULL PRIMARY KEY,
  AccessToken  NVARCHAR(MAX) NOT NULL,
  RefreshToken NVARCHAR(MAX) NULL,
  ExpiresAt    BIGINT        NOT NULL,
  MsUserEmail  NVARCHAR(150) NULL,
  UpdatedAt    DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

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

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OutlookCalendarEvents' AND xtype='U')
CREATE TABLE OutlookCalendarEvents (
  Id                NVARCHAR(36)  NOT NULL PRIMARY KEY,
  DirectorId        NVARCHAR(36)  NOT NULL,
  OutlookResourceId NVARCHAR(200) NOT NULL,
  Subject           NVARCHAR(250) NOT NULL,
  Body              NVARCHAR(MAX) NULL,
  StartDateTime     DATETIME2     NOT NULL,
  EndDateTime       DATETIME2     NULL,
  IsAllDay          BIT           NOT NULL DEFAULT 0,
  Location          NVARCHAR(300) NULL,
  Organizer         NVARCHAR(200) NULL,
  Attendees         NVARCHAR(MAX) NULL,
  RawData           NVARCHAR(MAX) NULL,
  SyncedAt          DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OutlookEmails' AND xtype='U')
CREATE TABLE OutlookEmails (
  Id                NVARCHAR(36)  NOT NULL PRIMARY KEY,
  DirectorId        NVARCHAR(36)  NOT NULL,
  OutlookResourceId NVARCHAR(200) NOT NULL,
  Subject           NVARCHAR(250) NOT NULL,
  FromAddress       NVARCHAR(200) NULL,
  FromName          NVARCHAR(200) NULL,
  ReceivedAt        DATETIME2     NULL,
  Preview           NVARCHAR(MAX) NULL,
  IsRead            BIT           NOT NULL DEFAULT 0,
  Importance        NVARCHAR(50)  NOT NULL DEFAULT 'normal',
  RawData           NVARCHAR(MAX) NULL,
  SyncedAt          DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OutlookTasks' AND xtype='U')
CREATE TABLE OutlookTasks (
  Id                NVARCHAR(36)  NOT NULL PRIMARY KEY,
  DirectorId        NVARCHAR(36)  NOT NULL,
  OutlookResourceId NVARCHAR(200) NOT NULL,
  Title             NVARCHAR(300) NOT NULL,
  ListName          NVARCHAR(200) NULL,
  Status            NVARCHAR(100) NOT NULL DEFAULT 'notStarted',
  Importance        NVARCHAR(50)  NOT NULL DEFAULT 'normal',
  DueDate           DATETIME2     NULL,
  ReminderDate      DATETIME2     NULL,
  Body              NVARCHAR(MAX) NULL,
  RawData           NVARCHAR(MAX) NULL,
  SyncedAt          DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OutlookReminders' AND xtype='U')
CREATE TABLE OutlookReminders (
  Id                NVARCHAR(36)  NOT NULL PRIMARY KEY,
  DirectorId        NVARCHAR(36)  NOT NULL,
  OutlookResourceId NVARCHAR(200) NOT NULL,
  Title             NVARCHAR(300) NOT NULL,
  ListName          NVARCHAR(200) NULL,
  DueDate           DATETIME2     NULL,
  ReminderDate      DATETIME2     NULL,
  Body              NVARCHAR(MAX) NULL,
  RawData           NVARCHAR(MAX) NULL,
  SyncedAt          DATETIME2     NOT NULL DEFAULT GETUTCDATE()
)

IF NOT EXISTS (SELECT 1 FROM DC_Users WHERE Email = 'chintan.patel@acornuniversalconsultancy.com')
INSERT INTO DC_Users (Id, Name, Email, Password, Role, Title, Avatar) VALUES ('usr-admin-001', 'Chintan Patel', 'chintan.patel@acornuniversalconsultancy.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi', 'admin', 'Personal Assistant', 'CP')

IF NOT EXISTS (SELECT 1 FROM DC_Users WHERE Email = 'director1@acornuniversalconsultancy.com')
INSERT INTO DC_Users (Id, Name, Email, Password, Role, Title, Avatar) VALUES ('usr-dir-001', 'Dhruval Patel', 'dhruval.patel@acornuniversalconsultancy.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi', 'director', 'Director', 'DP')

IF NOT EXISTS (SELECT 1 FROM DC_Users WHERE Email = 'director2@acornuniversalconsultancy.com')
INSERT INTO DC_Users (Id, Name, Email, Password, Role, Title, Avatar) VALUES ('usr-dir-002', 'Gaumish Patel', 'gaumish.patel@acornuniversalconsultancy.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi', 'director', 'Director', 'GP')

IF NOT EXISTS (SELECT 1 FROM DC_Users WHERE Email = 'director3@acornuniversalconsultancy.com')
INSERT INTO DC_Users (Id, Name, Email, Password, Role, Title, Avatar) VALUES ('usr-dir-003', 'Umesh Savaliya', 'umesh.savaliya@acornuniversalconsultancy.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi', 'director', 'Director', 'US')

IF NOT EXISTS (SELECT 1 FROM DC_Users WHERE Email = 'harsh.kansara@acornuniversalconsultancy.com')
INSERT INTO DC_Users (Id, Name, Email, Password, Role, Title, Avatar) VALUES ('usr-dir-004', 'Harsh Kansara', 'harsh.kansara@acornuniversalconsultancy.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi', 'director', 'Director', 'HK')
