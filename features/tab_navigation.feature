Feature: Tab Navigation
  As a user
  I want to navigate through different tabs
  So that I can access different sections of the application

  Scenario: Navigate through Contract tabs
    Given I am on the "New Contract" page
    Then I should see the following tabs:
      | policies     |
      | Catering     |
      | Main Member  |
      | Dependents   |
      | Beneficiaries|
      | Summary      |
    When I navigate through the following tabs:
      | policies     |
      | Catering     |
      | Main Member  |
      | Dependents   |
      | Beneficiaries|
      | Summary      |

  Scenario: Navigate through Main Member Form tabs
    Given I am on the "New Contract" page
    When I click on the "Main Member" tab
    Then I should see the following tabs:
      | Personal Information |
      | Contact Details     |
      | Address Details     |
    When I navigate through the following tabs:
      | Personal Information |
      | Contact Details     |
      | Address Details     |

  Scenario: Navigate through Claims tabs
    Given I am on the "Claims" page
    Then I should see the following tabs:
      | Policy Lookup |
      | Deceased     |
      | Bank Details |
      | Documents    |
      | Claim Form   |
      | Summary      |
      | Tracking     |
    When I navigate through the following tabs:
      | Policy Lookup |
      | Deceased     |
      | Bank Details |
      | Documents    |
      | Claim Form   |
      | Summary      |
      | Tracking     |

  Scenario: Navigate through Reports tabs
    Given I am on the "Reports" page
    Then I should see the following tabs:
      | Claims Report    |
      | Contract Report |
      | Payment Report  |
    When I navigate through the following tabs:
      | Claims Report    |
      | Contract Report |
      | Payment Report  |

  Scenario: Navigate through Beneficiary Form tabs
    Given I am on the "New Contract" page
    When I click on the "Beneficiaries" tab
    And I click on the "Add Beneficiary" button
    Then I should see the following tabs:
      | Personal Information |
      | Contact Details     |
      | Address Details     |
    When I navigate through the following tabs:
      | Personal Information |
      | Contact Details     |
      | Address Details     |

  Scenario: Navigate through Dependent Form tabs
    Given I am on the "New Contract" page
    When I click on the "Dependents" tab
    And I click on the "Add Dependent" button
    Then I should see the following tabs:
      | Personal Information |
      | Contact Details     |
      | Address Details     |
    When I navigate through the following tabs:
      | Personal Information |
      | Contact Details     |
      | Address Details     | 