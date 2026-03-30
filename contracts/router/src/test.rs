#![cfg(test)]
use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

#[test]
fn test_router_initialize() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RouterContract, ());
    let client = RouterContractClient::new(&env, &contract_id);
    let pool = Address::generate(&env);
    let token_a = Address::generate(&env);
    let token_b = Address::generate(&env);
    client.initialize(&pool, &token_a, &token_b);
    assert_eq!(client.get_pool(), pool);
}