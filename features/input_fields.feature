Feature: Input Field Interactions
  As a user
  I want to be able to enter values in different types of input fields
  So that I can interact with the application forms

  Scenario: Login as an admin user
    Given I am on the login page
    When I enter "admin@example.com" in the "Email" field
    And I enter "password123" in the "Password" field
    And I select "Production" in the "Environment" field
    And I check the "Login as Admin" checkbox
    And I click the button with text "Sign in"

  Scenario: Add a new main member
    Given I am on the add contract page
    When I select "Mr" in the "Title" field
    And I enter "John" in the "First Name" field
    And I enter "Doe" in the "Last Name" field
    And I enter "JD" in the "Initials" field
    And I select date "15/06/1990" in the "Date of Birth" field
    And I select "Male" in the "Gender" field
    And I select "English" in the "Language" field
    And I select "Married" in the "Marital Status" field
    And I select "South African" in the "Nationality" field
    And I select "South African ID" in the "Type of ID" field
    And I enter "9006155089081" in the "ID Number / Passport Number" field
    And I upload file "./test-data/id-document.pdf" to the "ID Document (PDF)" field

  Scenario: Add payment for a contract
    Given I am on the payments page
    When I enter "CON123456" in the "Contract Number" field
    And I click the button with text "Search"
    And I select "Cash" in the "Payment Method" field
    And I upload file "./test-data/receipt.jpg" to the "Receipt" field
    And I click the button with text "Add Payment"

  Scenario: Search for users
    Given I am on the user management page
    When I enter "johndoe" in the "Search by username" field
    And I select "Admin" in the "Role" field
    And I click the button with text "Search" 