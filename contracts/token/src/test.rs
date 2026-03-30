#![cfg(test)]
use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env, String};

#[test]
fn test_mint_and_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TokenContract, ());
    let client = TokenContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    client.initialize(
        &admin,
        &String::from_str(&env, "SwapToken"),
        &String::from_str(&env, "SWT"),
    );
    client.mint(&user, &1000);
    assert_eq!(client.balance(&user), 1000);
}

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TokenContract, ());
    let client = TokenContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.initialize(
        &admin,
        &String::from_str(&env, "SwapToken"),
        &String::from_str(&env, "SWT"),
    );
    client.mint(&alice, &500);
    client.transfer(&alice, &bob, &200);
    assert_eq!(client.balance(&alice), 300);
    assert_eq!(client.balance(&bob), 200);
}