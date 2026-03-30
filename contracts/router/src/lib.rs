#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, IntoVal,
};

#[contracttype]
pub enum DataKey {
    PoolContract,
    TokenAContract,
    TokenBContract,
}

#[contract]
pub struct RouterContract;

#[contractimpl]
impl RouterContract {
    pub fn initialize(env: Env, pool: Address, token_a: Address, token_b: Address) {
        env.storage().persistent().set(&DataKey::PoolContract, &pool);
        env.storage().persistent().set(&DataKey::TokenAContract, &token_a);
        env.storage().persistent().set(&DataKey::TokenBContract, &token_b);
    }

    pub fn swap(env: Env, user: Address, amount_in: i128, min_amount_out: i128) -> i128 {
        user.require_auth();
        let pool: Address = env.storage().persistent().get(&DataKey::PoolContract).unwrap();
        let amount_out: i128 = env.invoke_contract(
            &pool,
            &symbol_short!("swap_a_b"),
            soroban_sdk::vec![&env, user.into_val(&env), amount_in.into_val(&env)],
        );
        assert!(amount_out >= min_amount_out, "Slippage: output below minimum");
        env.events().publish((symbol_short!("routed"),), (amount_in, amount_out));
        amount_out
    }

    pub fn get_quote(env: Env, amount_in: i128) -> i128 {
        let pool: Address = env.storage().persistent().get(&DataKey::PoolContract).unwrap();
        env.invoke_contract(
            &pool,
            &symbol_short!("quote"),
            soroban_sdk::vec![&env, amount_in.into_val(&env)],
        )
    }

    pub fn add_liquidity(env: Env, provider: Address, amount_a: i128, amount_b: i128) -> i128 {
        provider.require_auth();
        let pool: Address = env.storage().persistent().get(&DataKey::PoolContract).unwrap();
        env.invoke_contract(
            &pool,
            &symbol_short!("add_liq"),
            soroban_sdk::vec![
                &env,
                provider.into_val(&env),
                amount_a.into_val(&env),
                amount_b.into_val(&env),
            ],
        )
    }

    pub fn get_pool(env: Env) -> Address {
        env.storage().persistent().get(&DataKey::PoolContract).unwrap()
    }
}

mod test;